import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { useAuth } from '../contexts/AuthContext';
import api, { getMediaUrl } from '../services/api';
import { DashboardConfirmModal } from './DashboardModal';
import FixtureMatch from './FixtureMatch';
import { compressPlayerPhoto, compressTeamLogo } from '../utils/imageCompression';
import clubLogo from '../assets/club-logo.png';
import '../styles/Dashboard.css';

const menuItems = [
  { id: 'campeonatos', icon: '🏆', label: 'Campeonatos' },
  { id: 'categorias', icon: '📋', label: 'Categorias' },
  { id: 'equipos', icon: '👥', label: 'Equipos' },
  { id: 'jugadores', icon: '🧑‍🤝‍🧑', label: 'Jugadores' },
  { id: 'inscripciones', icon: '📝', label: 'Inscripciones' },
  { id: 'fixture', icon: '🗓️', label: 'Fixture' },
  { id: 'partidos', icon: '🏐', label: 'Partidos' },
  { id: 'posiciones', icon: '📊', label: 'Posiciones' },
  { id: 'credenciales', icon: '🪪', label: 'Credenciales' },
  { id: 'usuarios', icon: '👤', label: 'Usuarios' },
];

const initialTorneo = {
  nombre: '',
  categoria: 'Senior',
  fecha_inicio: '',
  fecha_fin: '',
  lugar: '',
  descripcion: '',
  estado: 'PROGRAMADO',
};

const initialEquipo = {
  nombre: '',
  categoria: 'Masculino',
  color_principal: 'Rojo',
  logo_data_url: '',
  torneo: '',
};

const initialJugador = {
  nombre: '',
  apellido: '',
  tipo_persona: 'JUGADOR',
  documento: '',
  fecha_nacimiento: '',
  posicion: 'PUNTA',
  equipo: '',
  torneo: '',
  foto: null,
  foto_data_url: '',
  activo: true,
};

const initialCredencial = {
  torneo: '',
  jugador: '',
  tipo: 'JUGADOR',
  observacion: '',
};

const initialUsuario = {
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  telefono: '',
  rol: 'ENTRENADOR',
};

const initialFixture = {
  torneo: '',
  fecha_inicio: '',
  hora_partido: '',
  lugar: '',
  partidos_por_fecha: 5,
  dias_entre_fechas: 1,
  ida_y_vuelta: false,
  reemplazar: false,
};

const initialResultado = {
  partido: '',
  sets: [
    { numero: 1, puntos_local: '', puntos_visitante: '' },
    { numero: 2, puntos_local: '', puntos_visitante: '' },
    { numero: 3, puntos_local: '', puntos_visitante: '' },
  ],
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [torneos, setTorneos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [credenciales, setCredenciales] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [posiciones, setPosiciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [activeMenu, setActiveMenu] = useState('campeonatos');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [torneoForm, setTorneoForm] = useState(initialTorneo);
  const [editingTorneoId, setEditingTorneoId] = useState(null);
  const [equipoForm, setEquipoForm] = useState(initialEquipo);
  const [editingEquipoId, setEditingEquipoId] = useState(null);
  const [equipoLogoNombre, setEquipoLogoNombre] = useState('');
  const [jugadorForm, setJugadorForm] = useState(initialJugador);
  const [credencialForm, setCredencialForm] = useState(initialCredencial);
  const [jugadorFotoNombre, setJugadorFotoNombre] = useState('');
  const [selectedEquipoCredencial, setSelectedEquipoCredencial] = useState('');
  const [selectedEquipoDetalle, setSelectedEquipoDetalle] = useState('');
  const [editingJugadorId, setEditingJugadorId] = useState(null);
  const [usuarioForm, setUsuarioForm] = useState(initialUsuario);
  const [editingUsuarioId, setEditingUsuarioId] = useState(null);
  const [fixtureForm, setFixtureForm] = useState(initialFixture);
  const [resultadoForm, setResultadoForm] = useState(initialResultado);
  const [editingPartidoId, setEditingPartidoId] = useState(null);
  const [partidoForm, setPartidoForm] = useState({
    fecha: '',
    hora: '',
    lugar: '',
    estado: 'PROGRAMADO',
  });

  const torneoById = useMemo(() => {
    return Object.fromEntries(torneos.map((torneo) => [String(torneo.id), torneo]));
  }, [torneos]);

  const equipoById = useMemo(() => {
    return Object.fromEntries(equipos.map((equipo) => [String(equipo.id), equipo]));
  }, [equipos]);

  const categorias = useMemo(() => {
    const values = [
      ...torneos.map((torneo) => torneo.categoria),
      ...equipos.map((equipo) => equipo.categoria),
    ].filter(Boolean);
    return [...new Set(values)];
  }, [torneos, equipos]);

  const fixtureEquipos = useMemo(() => {
    if (!fixtureForm.torneo) return [];
    return equipos.filter((equipo) => String(equipo.torneo) === String(fixtureForm.torneo));
  }, [equipos, fixtureForm.torneo]);

  const fixturePartidos = useMemo(() => {
    if (!fixtureForm.torneo) return partidos;
    return partidos.filter((partido) => String(partido.torneo) === String(fixtureForm.torneo));
  }, [fixtureForm.torneo, partidos]);

  const fixturePreview = useMemo(() => {
    const totalEquipos = fixtureEquipos.length;
    const totalCruces = totalEquipos > 1 ? (totalEquipos * (totalEquipos - 1)) / 2 : 0;
    const totalPartidos = fixtureForm.ida_y_vuelta ? totalCruces * 2 : totalCruces;
    const partidosPorFecha = Math.max(Number(fixtureForm.partidos_por_fecha) || 1, 1);
    return {
      totalPartidos,
      totalFechas: totalPartidos ? Math.ceil(totalPartidos / partidosPorFecha) : 0,
    };
  }, [fixtureEquipos.length, fixtureForm.ida_y_vuelta, fixtureForm.partidos_por_fecha]);

  const refreshData = async () => {
    const [statsData, torneosData, equiposData, jugadoresData, credencialesData, partidosData, posicionesData, usuariosData] = await Promise.all([
      api.getDashboardStats(),
      api.getTorneos(),
      api.getEquipos(),
      api.getJugadores(),
      api.getCredenciales(),
      api.getPartidos(),
      api.getPosiciones(),
      api.getUsuarios(),
    ]);

    setStats(statsData);
    setTorneos(torneosData);
    setEquipos(equiposData);
    setJugadores(jugadoresData);
    setCredenciales(credencialesData);
    setPartidos(partidosData);
    setPosiciones(posicionesData);
    setUsuarios(usuariosData);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await api.getMe();

        if (userData.rol !== 'ADMIN') {
          navigate('/');
          return;
        }

        setUser(userData);
        await refreshData();
      } catch (err) {
        setError('Error al cargar el dashboard');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const handleSave = async (event, createFn, form, resetFn, successMessage) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      await createFn(form);
      resetFn();
      await refreshData();
      setNotice(successMessage);
    } catch (err) {
      setError('No se pudo guardar. Revisa los datos del formulario.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const setQuickSection = (section) => {
    setActiveMenu(section);
    setNotice('');
  };

  const requestConfirmation = (options) => new Promise((resolve) => {
    setConfirmModal({
      ...options,
      onCancel: () => {
        setConfirmModal(null);
        resolve(false);
      },
      onConfirm: () => {
        setConfirmModal(null);
        resolve(true);
      },
    });
  });

  const handleSaveTorneo = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (editingTorneoId) {
        await api.updateTorneo(editingTorneoId, torneoForm);
        setNotice('Campeonato actualizado correctamente.');
      } else {
        await api.createTorneo(torneoForm);
        setNotice('Campeonato creado correctamente.');
      }

      setTorneoForm(initialTorneo);
      setEditingTorneoId(null);
      await refreshData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar el campeonato.'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTorneo = (torneo) => {
    setActiveMenu('campeonatos');
    setEditingTorneoId(torneo.id);
    setTorneoForm({
      nombre: torneo.nombre || '',
      categoria: torneo.categoria || 'Senior',
      fecha_inicio: torneo.fecha_inicio || '',
      fecha_fin: torneo.fecha_fin || '',
      lugar: torneo.lugar || '',
      descripcion: torneo.descripcion || '',
      estado: torneo.estado || 'PROGRAMADO',
    });
    setError('');
    setNotice('');
  };

  const cancelEditTorneo = () => {
    setEditingTorneoId(null);
    setTorneoForm(initialTorneo);
  };

  const handleDeleteTorneo = async (torneo) => {
    const confirmed = await requestConfirmation({
      title: 'Eliminar campeonato',
      message: `Eliminar el campeonato "${torneo.nombre}"? Tambien se eliminaran sus equipos, jugadores, partidos y credenciales relacionados si el backend lo permite.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    setError('');
    setNotice('');
    try {
      await api.deleteTorneo(torneo.id);
      if (editingTorneoId === torneo.id) cancelEditTorneo();
      await refreshData();
      setNotice('Campeonato eliminado correctamente.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar el campeonato.'));
      console.error(err);
    }
  };

  const handleSaveEquipo = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (editingEquipoId) {
        await api.updateEquipo(editingEquipoId, equipoForm);
        setNotice('Equipo actualizado correctamente.');
      } else {
        await api.createEquipo(equipoForm);
        setNotice('Equipo creado correctamente.');
      }

      setEquipoForm(initialEquipo);
      setEditingEquipoId(null);
      setEquipoLogoNombre('');
      await refreshData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar el equipo.'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditEquipo = (equipo) => {
    setActiveMenu('equipos');
    setEditingEquipoId(equipo.id);
    setEquipoForm({
      nombre: equipo.nombre || '',
      categoria: equipo.categoria || 'Masculino',
      color_principal: equipo.color_principal || 'Rojo',
      logo_data_url: equipo.logo_data_url || '',
      torneo: equipo.torneo || '',
    });
    setEquipoLogoNombre('');
    setSelectedEquipoDetalle(String(equipo.id));
    setError('');
    setNotice('');
  };

  const cancelEditEquipo = () => {
    setEditingEquipoId(null);
    setEquipoForm(initialEquipo);
    setEquipoLogoNombre('');
  };

  const handleEquipoLogoChange = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    try {
      const logoDataUrl = await compressTeamLogo(file);
      setEquipoLogoNombre(file.name);
      setEquipoForm((current) => ({ ...current, logo_data_url: logoDataUrl }));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = '';
    }
  };

  const clearEquipoLogo = () => {
    setEquipoLogoNombre('');
    setEquipoForm((current) => ({ ...current, logo_data_url: '' }));
  };

  const handleJugadorFotoChange = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    try {
      const fotoDataUrl = await compressPlayerPhoto(file);
      setJugadorFotoNombre(file.name);
      setJugadorForm((current) => ({ ...current, foto: null, foto_data_url: fotoDataUrl }));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteEquipo = async (equipo) => {
    const confirmed = await requestConfirmation({
      title: 'Eliminar equipo',
      message: `Eliminar el equipo "${equipo.nombre}"? Tambien se quitaran sus jugadores y datos relacionados si el backend lo permite.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    setError('');
    setNotice('');
    try {
      await api.deleteEquipo(equipo.id);
      if (editingEquipoId === equipo.id) cancelEditEquipo();
      if (selectedEquipoDetalle === String(equipo.id)) setSelectedEquipoDetalle('');
      await refreshData();
      setNotice('Equipo eliminado correctamente.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar el equipo.'));
      console.error(err);
    }
  };

  const handleGenerateTeamCredentials = async (equipoId) => {
    const equipo = equipos.find((item) => String(item.id) === String(equipoId));
    const equipoJugadores = jugadores.filter((jugador) => String(jugador.equipo) === String(equipoId));

    if (!equipo || !equipoJugadores.length) {
      setError('Selecciona un equipo que tenga jugadores registrados.');
      return;
    }

    setError('');
    setNotice('');

    const cards = await Promise.all(equipoJugadores.map(async (jugador) => {
      const secureCode = buildCredentialCode(equipo, jugador);
      const qrPayload = `Jugador: ${jugador.nombre} ${jugador.apellido}\nCI: ${jugador.documento}`;
      const qr = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 160,
      });

      return { jugador, qr, secureCode };
    }));

    await downloadCredentialsPdf({
      equipo,
      torneo: torneoById[String(equipo.torneo)],
      cards,
    });

    setNotice(`PDF de credenciales generado para ${equipo.nombre}.`);
  };

  const handleDeleteJugador = async (jugadorId) => {
    const confirmed = await requestConfirmation({
      title: 'Eliminar jugador',
      message: 'Eliminar este jugador?',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.deleteJugador(jugadorId);
      await refreshData();
      setNotice('Jugador eliminado correctamente.');
    } catch (err) {
      setError('No se pudo eliminar el jugador.');
      console.error(err);
    }
  };

  const handleEditJugador = (jugador) => {
    setActiveMenu('jugadores');
    setEditingJugadorId(jugador.id);
    setJugadorForm({
      nombre: jugador.nombre,
      apellido: jugador.apellido,
      tipo_persona: jugador.tipo_persona || 'JUGADOR',
      documento: jugador.documento,
      fecha_nacimiento: jugador.fecha_nacimiento,
      posicion: jugador.posicion,
      equipo: jugador.equipo,
      torneo: jugador.torneo,
      foto: null,
      foto_data_url: jugador.foto_data_url || '',
      activo: jugador.activo,
    });
    setJugadorFotoNombre('');
  };

  const handleSaveJugador = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (editingJugadorId) {
        await api.updateJugador(editingJugadorId, jugadorForm);
        setNotice('Jugador actualizado correctamente.');
      } else {
        await api.createJugador(jugadorForm);
        setNotice('Jugador creado correctamente.');
      }

      setJugadorForm(initialJugador);
      setJugadorFotoNombre('');
      setEditingJugadorId(null);
      await refreshData();
    } catch (err) {
      setError('No se pudo guardar el jugador. Revisa los datos.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUsuario = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const usuarioPayload = buildUsuarioPayload(usuarioForm);

      if (editingUsuarioId) {
        const payload = { ...usuarioPayload };
        if (!payload.password) delete payload.password;
        await api.updateUsuario(editingUsuarioId, payload);
        setNotice('Usuario actualizado correctamente.');
      } else {
        await api.createUsuario(usuarioPayload);
        setNotice('Usuario creado correctamente.');
      }

      setUsuarioForm(initialUsuario);
      setEditingUsuarioId(null);
      await refreshData();
    } catch (err) {
      setError('No se pudo guardar el usuario. Revisa usuario, celular y contraseña.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditUsuario = (usuario) => {
    setEditingUsuarioId(usuario.id);
    setUsuarioForm({
      username: usuario.username || '',
      email: usuario.email || '',
      password: '',
      first_name: usuario.first_name || '',
      last_name: usuario.last_name || '',
      telefono: usuario.telefono || '',
      rol: usuario.rol || 'ENTRENADOR',
    });
  };

  const handleDeleteUsuario = async (usuarioId) => {
    const confirmed = await requestConfirmation({
      title: 'Eliminar usuario',
      message: 'Eliminar este usuario?',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.deleteUsuario(usuarioId);
      if (editingUsuarioId === usuarioId) {
        setEditingUsuarioId(null);
        setUsuarioForm(initialUsuario);
      }
      await refreshData();
      setNotice('Usuario eliminado correctamente.');
    } catch (err) {
      setError('No se pudo eliminar el usuario.');
      console.error(err);
    }
  };

  const handleEditPartido = (partido) => {
    setActiveMenu('partidos');
    setEditingPartidoId(partido.id);
    setPartidoForm({
      fecha: partido.fecha || '',
      hora: formatTime(partido.hora),
      lugar: partido.lugar || '',
      estado: partido.estado || 'PROGRAMADO',
    });
    setError('');
    setNotice('');
  };

  const cancelEditPartido = () => {
    setEditingPartidoId(null);
    setPartidoForm({
      fecha: '',
      hora: '',
      lugar: '',
      estado: 'PROGRAMADO',
    });
  };

  const handleSavePartido = async (event) => {
    event.preventDefault();
    if (!editingPartidoId) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api.updatePartido(editingPartidoId, partidoForm);
      cancelEditPartido();
      await refreshData();
      setNotice('Partido actualizado correctamente.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo actualizar el partido.'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePartido = async (partido) => {
    const confirmed = await requestConfirmation({
      title: 'Eliminar partido',
      message: `Eliminar ${partido.equipo_local_nombre} vs ${partido.equipo_visitante_nombre}?`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    setError('');
    setNotice('');
    try {
      await api.deletePartido(partido.id);
      if (editingPartidoId === partido.id) cancelEditPartido();
      await refreshData();
      setNotice('Partido eliminado correctamente.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar el partido.'));
      console.error(err);
    }
  };

  const handleDeleteCredencial = async (credencial) => {
    const confirmed = await requestConfirmation({
      title: 'Eliminar credencial',
      message: `Eliminar la credencial ${credencial.codigo}?`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    setError('');
    setNotice('');
    try {
      await api.deleteCredencial(credencial.id);
      await refreshData();
      setNotice('Credencial eliminada correctamente.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar la credencial.'));
      console.error(err);
    }
  };

  const openTorneoEquipos = (torneoId) => {
    const firstEquipo = equipos.find((equipo) => String(equipo.torneo) === String(torneoId));
    setSelectedEquipoDetalle(firstEquipo ? String(firstEquipo.id) : '');
    setQuickSection('equipos');
  };

  const openTorneoFixture = (torneo) => {
    setFixtureForm({
      ...fixtureForm,
      torneo: String(torneo.id),
      fecha_inicio: torneo.fecha_inicio || fixtureForm.fecha_inicio,
      lugar: torneo.lugar || fixtureForm.lugar,
    });
    setQuickSection('fixture');
  };

  const handleGenerarFixture = async (event) => {
    event.preventDefault();

    if (fixtureEquipos.length < 2) {
      setError(`No se puede generar fixture: este campeonato tiene ${fixtureEquipos.length} equipo(s). Registra al menos 2 equipos en el mismo campeonato.`);
      setNotice('');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api.generarFixture({
        ...fixtureForm,
        partidos_por_fecha: Number(fixtureForm.partidos_por_fecha),
        dias_entre_fechas: Number(fixtureForm.dias_entre_fechas),
      });
      await refreshData();
      setNotice('Fixture generado correctamente.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo generar el fixture. Revisa equipos, torneo o si ya existen partidos.'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrarResultado = async (event) => {
    event.preventDefault();

    if (!resultadoForm.partido) {
      setError('Selecciona un partido.');
      return;
    }

    const sets = resultadoForm.sets
      .filter((set) => set.puntos_local !== '' && set.puntos_visitante !== '')
      .map((set) => ({
        numero: Number(set.numero),
        puntos_local: Number(set.puntos_local),
        puntos_visitante: Number(set.puntos_visitante),
      }));

    if (!sets.length) {
      setError('Registra al menos un set.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api.registrarResultado(resultadoForm.partido, { sets });
      setResultadoForm(initialResultado);
      await refreshData();
      setNotice('Resultado registrado y tabla actualizada.');
    } catch (err) {
      setError('No se pudo registrar el resultado. Revisa que ningun set quede empatado.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePartidoHora = async (partidoId, hora) => {
    try {
      await api.updatePartido(partidoId, { hora });
      setPartidos((current) => current.map((partido) => (
        partido.id === partidoId ? { ...partido, hora } : partido
      )));
      setNotice('Hora del partido actualizada.');
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo actualizar la hora del partido.'));
      console.error(err);
    }
  };

  const handleDownloadFixturePdf = async () => {
    if (!fixturePartidos.length) {
      setError('No hay partidos para descargar. Primero genera el fixture.');
      setNotice('');
      return;
    }

    const torneo = fixtureForm.torneo ? torneoById[String(fixtureForm.torneo)] : null;
    await downloadFixturePdf({
      torneo,
      partidos: fixturePartidos,
    });
    setError('');
    setNotice('PDF del fixture generado correctamente.');
  };

  const updateResultadoSet = (index, key, value) => {
    const sets = resultadoForm.sets.map((set, setIndex) => (
      setIndex === index ? { ...set, [key]: value } : set
    ));
    setResultadoForm({ ...resultadoForm, sets });
  };

  const addResultadoSet = () => {
    setResultadoForm({
      ...resultadoForm,
      sets: [
        ...resultadoForm.sets,
        { numero: resultadoForm.sets.length + 1, puntos_local: '', puntos_visitante: '' },
      ],
    });
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Cargando...</div>
      </div>
    );
  }

  return (
    <>
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="brand-lockup">
            <img src={clubLogo} alt="Ayacucho Club de Voleibol" className="club-logo" />
            <div>
              <h1>AYACUCHO CLUB DE VOLEIBOL</h1>
              <p>Panel de Administracion</p>
            </div>
          </div>
          <div className="user-info">
            <span className="user-name">{user?.first_name || user?.username}</span>
            <button className="logout-btn" onClick={handleLogout}>
              Cerrar Sesion
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeMenu === item.id ? 'active' : ''}`}
                onClick={() => setQuickSection(item.id)}
                type="button"
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="dashboard-content">
          {error && <div className="error">{error}</div>}
          {notice && <div className="success-message">{notice}</div>}

          <section className="welcome-section">
            <h2>Bienvenido, Administrador</h2>
            <p>Panel de control del campeonato de voleibol</p>
          </section>

          <section className="stats-section">
            <StatCard icon="🏆" title="Campeonatos" value={stats?.total_torneos || 0} />
            <StatCard icon="👥" title="Equipos" value={stats?.total_equipos || 0} />
            <StatCard icon="🧑‍🤝‍🧑" title="Jugadores" value={stats?.total_jugadores || 0} />
            <StatCard icon="👤" title="Usuarios" value={stats?.total_usuarios || 0} />
            <StatCard icon="🟢" title="Activos" value={stats?.torneos_activos || 0} />
          </section>

          <section className="actions-section">
            <h3>Acciones Rapidas</h3>
            <div className="action-buttons">
              <button className="action-btn primary" onClick={() => setQuickSection('campeonatos')}>
                Crear Campeonato
              </button>
              <button className="action-btn" onClick={() => setQuickSection('inscripciones')}>
                Revisar Inscripciones
              </button>
              <button className="action-btn" onClick={() => setQuickSection('fixture')}>
                Generar Fixture
              </button>
              <button className="action-btn" onClick={() => setQuickSection('credenciales')}>
                Generar Credenciales
              </button>
            </div>
          </section>

          <section className="panel-section">
            {activeMenu === 'campeonatos' && (
              <Panel title="Campeonatos" subtitle="Crea y revisa los torneos registrados.">
                <form
                  className="dashboard-form"
                  onSubmit={handleSaveTorneo}
                >
                  <input placeholder="Nombre" value={torneoForm.nombre} onChange={(e) => setTorneoForm({ ...torneoForm, nombre: e.target.value })} required />
                  <input placeholder="Categoria" value={torneoForm.categoria} onChange={(e) => setTorneoForm({ ...torneoForm, categoria: e.target.value })} required />
                  <input type="date" value={torneoForm.fecha_inicio} onChange={(e) => setTorneoForm({ ...torneoForm, fecha_inicio: e.target.value })} required />
                  <input type="date" value={torneoForm.fecha_fin} onChange={(e) => setTorneoForm({ ...torneoForm, fecha_fin: e.target.value })} required />
                  <input placeholder="Lugar" value={torneoForm.lugar} onChange={(e) => setTorneoForm({ ...torneoForm, lugar: e.target.value })} required />
                  <select value={torneoForm.estado} onChange={(e) => setTorneoForm({ ...torneoForm, estado: e.target.value })}>
                    <option value="PROGRAMADO">Programado</option>
                    <option value="EN_CURSO">En curso</option>
                    <option value="FINALIZADO">Finalizado</option>
                  </select>
                  <textarea placeholder="Descripcion" value={torneoForm.descripcion} onChange={(e) => setTorneoForm({ ...torneoForm, descripcion: e.target.value })} />
                  <button className="action-btn primary" disabled={saving}>
                    {editingTorneoId ? 'Actualizar campeonato' : 'Guardar campeonato'}
                  </button>
                  {editingTorneoId && (
                    <button className="action-btn" type="button" onClick={cancelEditTorneo}>
                      Cancelar edicion
                    </button>
                  )}
                </form>
                <DataTable
                  headers={['Nombre', 'Categoria', 'Inicio', 'Fin', 'Lugar', 'Estado', 'Acciones']}
                  rows={torneos.map((torneo) => [
                    torneo.nombre,
                    torneo.categoria,
                    torneo.fecha_inicio,
                    torneo.fecha_fin,
                    torneo.lugar,
                    torneo.estado,
                    <div key={`torneo-${torneo.id}`} className="row-actions">
                      <button type="button" onClick={() => handleEditTorneo(torneo)}>Editar</button>
                      <button type="button" onClick={() => openTorneoEquipos(torneo.id)}>Equipos</button>
                      <button type="button" onClick={() => openTorneoFixture(torneo)}>Fixture</button>
                      <button type="button" className="danger" onClick={() => handleDeleteTorneo(torneo)}>Eliminar</button>
                    </div>,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'categorias' && (
              <Panel title="Categorias" subtitle="Categorias detectadas en campeonatos y equipos.">
                <div className="category-grid">
                  {categorias.length ? categorias.map((categoria) => (
                    <div className="category-chip" key={categoria}>{categoria}</div>
                  )) : <EmptyState text="No hay categorias registradas." />}
                </div>
              </Panel>
            )}

            {activeMenu === 'equipos' && (
              <Panel title="Equipos" subtitle="Registra equipos y asignales un campeonato.">
                <form
                  className="dashboard-form"
                  onSubmit={handleSaveEquipo}
                >
                  <input placeholder="Nombre del equipo" value={equipoForm.nombre} onChange={(e) => setEquipoForm({ ...equipoForm, nombre: e.target.value })} required />
                  <input placeholder="Categoria" value={equipoForm.categoria} onChange={(e) => setEquipoForm({ ...equipoForm, categoria: e.target.value })} required />
                  <select value={equipoForm.torneo} onChange={(e) => setEquipoForm({ ...equipoForm, torneo: e.target.value })} required>
                    <option value="">Seleccionar torneo</option>
                    {torneos.map((torneo) => <option key={torneo.id} value={torneo.id}>{torneo.nombre}</option>)}
                  </select>
                  <label className="image-input-label">
                    <span>{equipoLogoNombre || (equipoForm.logo_data_url ? 'Logo cargado' : 'Logo del equipo')}</span>
                    <input type="file" accept="image/*" onChange={handleEquipoLogoChange} />
                  </label>
                  {equipoForm.logo_data_url && (
                    <div className="image-preview-card">
                      <img src={equipoForm.logo_data_url} alt="Vista previa del logo" />
                      <button type="button" onClick={clearEquipoLogo}>Quitar</button>
                    </div>
                  )}
                  <button className="action-btn primary" disabled={saving}>
                    {editingEquipoId ? 'Actualizar equipo' : 'Guardar equipo'}
                  </button>
                  {editingEquipoId && (
                    <button className="action-btn" type="button" onClick={cancelEditEquipo}>
                      Cancelar edicion
                    </button>
                  )}
                </form>
                <div className="team-list">
                  {equipos.length ? equipos.map((equipo) => {
                    const equipoJugadores = jugadores.filter((jugador) => String(jugador.equipo) === String(equipo.id));

                    return (
                      <article className="team-card" key={equipo.id}>
                        {getTeamLogoSrc(equipo) ? <img className="team-logo-thumb large" src={getTeamLogoSrc(equipo)} alt={equipo.nombre} /> : null}
                        <div>
                          <h4>{equipo.nombre}</h4>
                          <p>{torneoById[String(equipo.torneo)]?.nombre || 'Sin torneo'} · {equipo.categoria}</p>
                          <span>{equipoJugadores.length} jugadores registrados</span>
                        </div>
                        <div className="team-actions">
                          <button className="action-btn" type="button" onClick={() => setSelectedEquipoDetalle(String(equipo.id))}>
                            Ver jugadores
                          </button>
                          <button className="action-btn" type="button" onClick={() => handleEditEquipo(equipo)}>
                            Editar equipo
                          </button>
                          <button className="action-btn primary" type="button" onClick={() => handleGenerateTeamCredentials(equipo.id)}>
                            Descargar credenciales
                          </button>
                          <button className="action-btn danger" type="button" onClick={() => handleDeleteEquipo(equipo)}>
                            Eliminar equipo
                          </button>
                        </div>
                      </article>
                    );
                  }) : <EmptyState text="Todavia no hay equipos registrados." />}
                </div>
                {selectedEquipoDetalle && (
                  <div className="team-detail">
                    <h4>Jugadores de {equipoById[selectedEquipoDetalle]?.nombre}</h4>
                    <DataTable
                      headers={['Jugador', 'Foto', 'Tipo', 'Documento', 'Posicion', 'Acciones']}
                      rows={jugadores
                        .filter((jugador) => String(jugador.equipo) === selectedEquipoDetalle)
                        .map((jugador) => [
                          `${jugador.nombre} ${jugador.apellido}`,
                          getPlayerPhotoSrc(jugador) ? <img key={`foto-detalle-${jugador.id}`} className="player-thumb" src={getPlayerPhotoSrc(jugador)} alt={`${jugador.nombre} ${jugador.apellido}`} /> : '-',
                          jugador.tipo_persona || 'JUGADOR',
                          jugador.documento,
                          jugador.posicion,
                          <div key={`acciones-${jugador.id}`} className="row-actions">
                            <button type="button" onClick={() => handleEditJugador(jugador)}>Editar</button>
                            <button type="button" className="danger" onClick={() => handleDeleteJugador(jugador.id)}>Eliminar</button>
                          </div>,
                        ])}
                    />
                  </div>
                )}
              </Panel>
            )}

            {activeMenu === 'jugadores' && (
              <Panel title="Jugadores" subtitle="Registra jugadores y vincula su equipo.">
                <form
                  className="dashboard-form"
                  onSubmit={handleSaveJugador}
                >
                  <input placeholder="Nombre" value={jugadorForm.nombre} onChange={(e) => setJugadorForm({ ...jugadorForm, nombre: e.target.value })} required />
                  <input placeholder="Apellido" value={jugadorForm.apellido} onChange={(e) => setJugadorForm({ ...jugadorForm, apellido: e.target.value })} required />
                  <select value={jugadorForm.tipo_persona} onChange={(e) => setJugadorForm({ ...jugadorForm, tipo_persona: e.target.value })}>
                    <option value="JUGADOR">Jugador</option>
                    <option value="ENTRENADOR">Entrenador</option>
                  </select>
                  <input placeholder="Documento" value={jugadorForm.documento} onChange={(e) => setJugadorForm({ ...jugadorForm, documento: e.target.value })} required />
                  <input type="date" value={jugadorForm.fecha_nacimiento} onChange={(e) => setJugadorForm({ ...jugadorForm, fecha_nacimiento: e.target.value })} required />
                  <select value={jugadorForm.posicion} onChange={(e) => setJugadorForm({ ...jugadorForm, posicion: e.target.value })}>
                    <option value="LIBERO">Libero</option>
                    <option value="PUNTA">Punta</option>
                    <option value="CENTRAL">Central</option>
                    <option value="OPUESTO">Opuesto</option>
                    <option value="COLOCADOR">Colocador</option>
                    <option value="REVANCHA">Revancha</option>
                  </select>
                  <select value={jugadorForm.equipo} onChange={(e) => {
                    const equipo = equipoById[e.target.value];
                    setJugadorForm({ ...jugadorForm, equipo: e.target.value, torneo: equipo?.torneo || '' });
                  }} required>
                    <option value="">Seleccionar equipo</option>
                    {equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>)}
                  </select>
                  <label className="file-input-label">
                    <span>{jugadorFotoNombre || 'Foto del jugador'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleJugadorFotoChange}
                    />
                  </label>
                  <button className="action-btn primary" disabled={saving}>
                    {editingJugadorId ? 'Actualizar jugador' : 'Guardar jugador'}
                  </button>
                  {editingJugadorId && (
                    <button className="action-btn" type="button" onClick={() => {
                      setEditingJugadorId(null);
                      setJugadorForm(initialJugador);
                      setJugadorFotoNombre('');
                    }}>
                      Cancelar edicion
                    </button>
                  )}
                </form>
                <DataTable
                  headers={['Jugador', 'Foto', 'Tipo', 'Documento', 'Posicion', 'Equipo', 'Activo', 'Acciones']}
                  rows={jugadores.map((jugador) => [
                    `${jugador.nombre} ${jugador.apellido}`,
                    getPlayerPhotoSrc(jugador) ? <img key={`foto-${jugador.id}`} className="player-thumb" src={getPlayerPhotoSrc(jugador)} alt={`${jugador.nombre} ${jugador.apellido}`} /> : '-',
                    jugador.tipo_persona || 'JUGADOR',
                    jugador.documento,
                    jugador.posicion,
                    equipoById[String(jugador.equipo)]?.nombre || 'Sin equipo',
                    jugador.activo ? 'Si' : 'No',
                    <div key={`jugador-${jugador.id}`} className="row-actions">
                      <button type="button" onClick={() => handleEditJugador(jugador)}>Editar</button>
                      <button type="button" className="danger" onClick={() => handleDeleteJugador(jugador.id)}>Eliminar</button>
                    </div>,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'inscripciones' && (
              <Panel title="Inscripciones" subtitle="Resumen de equipos inscritos por campeonato.">
                <DataTable
                  headers={['Campeonato', 'Equipos inscritos', 'Jugadores registrados', 'Estado', 'Acciones']}
                  rows={torneos.map((torneo) => {
                    const torneoEquipos = equipos.filter((equipo) => String(equipo.torneo) === String(torneo.id));
                    const torneoJugadores = jugadores.filter((jugador) => String(jugador.torneo) === String(torneo.id));
                    return [
                      torneo.nombre,
                      torneoEquipos.length,
                      torneoJugadores.length,
                      torneo.estado,
                      <div key={`inscripcion-${torneo.id}`} className="row-actions">
                        <button type="button" onClick={() => openTorneoEquipos(torneo.id)}>Gestionar equipos</button>
                        <button type="button" onClick={() => openTorneoFixture(torneo)}>Fixture</button>
                      </div>,
                    ];
                  })}
                />
              </Panel>
            )}

            {activeMenu === 'fixture' && (
              <Panel title="Fixture" subtitle="Genera los cruces automaticamente con los equipos inscritos.">
                <GuideBox
                  title="Como llenar el fixture"
                  items={[
                    'Primero selecciona el campeonato que ya tiene equipos registrados.',
                    'La fecha indica la jornada o dia de juego para los cruces generados.',
                    'La hora programada se aplica al generar, luego puedes cambiar la hora de cada partido en la tabla.',
                    'Si el campeonato es largo, define cuantos partidos se juegan por fecha; el sistema reparte el resto en nuevas jornadas.',
                    'El sistema ordena los partidos como Partido 1, Partido 2, Partido 3.',
                    'El lugar puede ser el coliseo o cancha donde se jugara la jornada.',
                    'Usa reemplazar solo si quieres borrar el fixture anterior de ese campeonato y generarlo de nuevo.',
                  ]}
                />
                <form className="dashboard-form" onSubmit={handleGenerarFixture}>
                  <Field label="Campeonato" help="El sistema usara los equipos inscritos en este campeonato.">
                    <select value={fixtureForm.torneo} onChange={(e) => {
                      const torneo = torneoById[e.target.value];
                      setFixtureForm({
                        ...fixtureForm,
                        torneo: e.target.value,
                        fecha_inicio: torneo?.fecha_inicio || fixtureForm.fecha_inicio,
                        lugar: torneo?.lugar || fixtureForm.lugar,
                      });
                    }} required>
                      <option value="">Seleccionar campeonato</option>
                      {torneos.map((torneo) => <option key={torneo.id} value={torneo.id}>{torneo.nombre}</option>)}
                    </select>
                  </Field>
                  {fixtureForm.torneo && (
                    <div className={`fixture-team-status ${fixtureEquipos.length >= 2 ? 'ready' : 'blocked'}`}>
                      <strong>{fixtureEquipos.length} equipo(s) en este campeonato</strong>
                      <span>
                        {fixtureEquipos.length >= 2
                          ? `Listo: ${fixturePreview.totalPartidos} partido(s) en ${fixturePreview.totalFechas} fecha(s). Equipos: ${fixtureEquipos.map((equipo) => equipo.nombre).join(', ')}`
                          : 'Falta registrar al menos otro equipo en este mismo campeonato.'}
                      </span>
                    </div>
                  )}
                  <Field label="Fecha del primer partido" help="Ejemplo: 22/08/2026.">
                    <input type="date" value={fixtureForm.fecha_inicio} onChange={(e) => setFixtureForm({ ...fixtureForm, fecha_inicio: e.target.value })} required />
                  </Field>
                  <Field label="Hora base" help="Se aplica al generar. Despues puedes cambiar cada partido en la tabla.">
                    <input type="time" value={fixtureForm.hora_partido} onChange={(e) => setFixtureForm({ ...fixtureForm, hora_partido: e.target.value })} required />
                  </Field>
                  <Field label="Lugar o cancha" help="Ejemplo: Coliseo Municipal / Cancha 1.">
                    <input placeholder="Coliseo Municipal" value={fixtureForm.lugar} onChange={(e) => setFixtureForm({ ...fixtureForm, lugar: e.target.value })} required />
                  </Field>
                  <Field label="Partidos por fecha" help="Ejemplo: 5. Si hay 45 partidos, se reparten en 9 fechas.">
                    <input type="number" min="1" value={fixtureForm.partidos_por_fecha} onChange={(e) => setFixtureForm({ ...fixtureForm, partidos_por_fecha: e.target.value })} required />
                  </Field>
                  <Field label="Dias entre fechas" help="1 = todos los dias. 7 = una fecha por semana.">
                    <input type="number" min="1" value={fixtureForm.dias_entre_fechas} onChange={(e) => setFixtureForm({ ...fixtureForm, dias_entre_fechas: e.target.value })} required />
                  </Field>
                  <Field label="Modalidad" help="Activa ida y vuelta para que cada cruce se juegue dos veces.">
                    <label className="checkbox-line">
                      <input type="checkbox" checked={fixtureForm.ida_y_vuelta} onChange={(e) => setFixtureForm({ ...fixtureForm, ida_y_vuelta: e.target.checked })} />
                      Ida y vuelta
                    </label>
                  </Field>
                  <Field label="Regenerar fixture" help="Solo usar si ya generaste partidos y quieres reemplazarlos.">
                    <label className="checkbox-line">
                      <input type="checkbox" checked={fixtureForm.reemplazar} onChange={(e) => setFixtureForm({ ...fixtureForm, reemplazar: e.target.checked })} />
                      Reemplazar partidos existentes
                    </label>
                  </Field>
                  <button className="action-btn primary" disabled={saving || fixtureEquipos.length < 2}>Generar fixture</button>
                </form>
                <div className="fixture-actions">
                  <button className="action-btn" type="button" onClick={handleDownloadFixturePdf} disabled={!fixturePartidos.length}>
                    Descargar fixture PDF
                  </button>
                </div>
                <DataTable
                  headers={['Orden', 'Ronda', 'Fecha', 'Hora', 'Lugar', 'Campeonato', 'Partido', 'Estado', 'Acciones']}
                  rows={fixturePartidos.map((partido) => [
                    `Partido ${partido.orden}`,
                    partido.ronda,
                    partido.fecha,
                    <input
                      aria-label={`Hora del partido ${partido.orden}`}
                      className="table-time-input"
                      key={`hora-${partido.id}`}
                      type="time"
                      value={formatTime(partido.hora)}
                      onChange={(e) => handleUpdatePartidoHora(partido.id, e.target.value)}
                    />,
                    partido.lugar,
                    partido.torneo_nombre,
                    <FixtureMatch key={`match-${partido.id}`} partido={partido} equiposById={equipoById} />,
                    partido.estado,
                    <div key={`fixture-partido-${partido.id}`} className="row-actions">
                      <button type="button" onClick={() => handleEditPartido(partido)}>Editar</button>
                      <button type="button" className="danger" onClick={() => handleDeletePartido(partido)}>Eliminar</button>
                    </div>,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'partidos' && (
              <Panel title="Partidos" subtitle="Registra los sets y el sistema calcula ganador y puntos.">
                <GuideBox
                  title="Como cargar un resultado"
                  items={[
                    'Selecciona el partido que ya fue jugado.',
                    'Escribe los puntos de cada set: local a la izquierda y visitante a la derecha.',
                    'No dejes un set empatado. Si jugaron 4 o 5 sets, usa Agregar set.',
                    'Al guardar, el ganador suma 2 puntos y el perdedor suma 1 punto; PF y PC se calculan solos.',
                  ]}
                />
                {editingPartidoId && (
                  <form className="dashboard-form compact-form" onSubmit={handleSavePartido}>
                    <Field label="Fecha" help="Actualiza la jornada del partido.">
                      <input type="date" value={partidoForm.fecha} onChange={(e) => setPartidoForm({ ...partidoForm, fecha: e.target.value })} required />
                    </Field>
                    <Field label="Hora" help="Hora programada del encuentro.">
                      <input type="time" value={partidoForm.hora} onChange={(e) => setPartidoForm({ ...partidoForm, hora: e.target.value })} required />
                    </Field>
                    <Field label="Lugar" help="Cancha o coliseo.">
                      <input placeholder="Cancha 1" value={partidoForm.lugar} onChange={(e) => setPartidoForm({ ...partidoForm, lugar: e.target.value })} required />
                    </Field>
                    <Field label="Estado" help="Controla si el partido sigue pendiente o ya concluyo.">
                      <select value={partidoForm.estado} onChange={(e) => setPartidoForm({ ...partidoForm, estado: e.target.value })}>
                        <option value="PROGRAMADO">Programado</option>
                        <option value="EN_CURSO">En curso</option>
                        <option value="FINALIZADO">Finalizado</option>
                        <option value="SUSPENDIDO">Suspendido</option>
                        <option value="CANCELADO">Cancelado</option>
                      </select>
                    </Field>
                    <button className="action-btn primary" disabled={saving}>Actualizar partido</button>
                    <button className="action-btn" type="button" onClick={cancelEditPartido}>Cancelar edicion</button>
                  </form>
                )}
                <form className="dashboard-form" onSubmit={handleRegistrarResultado}>
                  <Field label="Partido jugado" help="El primer equipo es local; el segundo es visitante.">
                    <select value={resultadoForm.partido} onChange={(e) => setResultadoForm({ ...resultadoForm, partido: e.target.value })} required>
                      <option value="">Seleccionar partido</option>
                      {partidos.map((partido) => (
                        <option key={partido.id} value={partido.id}>
                          {partido.equipo_local_nombre} vs {partido.equipo_visitante_nombre} - {partido.fecha}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="sets-grid">
                    <div className="set-row set-row-head">
                      <span>Set</span>
                      <span>Local</span>
                      <span>Visitante</span>
                    </div>
                    {resultadoForm.sets.map((set, index) => (
                      <div className="set-row" key={`set-${set.numero}`}>
                        <span>Set {set.numero}</span>
                        <input type="number" min="0" placeholder="Ej. 25" value={set.puntos_local} onChange={(e) => updateResultadoSet(index, 'puntos_local', e.target.value)} />
                        <input type="number" min="0" placeholder="Ej. 12" value={set.puntos_visitante} onChange={(e) => updateResultadoSet(index, 'puntos_visitante', e.target.value)} />
                      </div>
                    ))}
                    <p className="form-hint">Ejemplo: si el local gano 25 a 12, escribe 25 en Local y 12 en Visitante.</p>
                  </div>
                  <button className="action-btn" type="button" onClick={addResultadoSet}>Agregar set</button>
                  <button className="action-btn primary" disabled={saving}>Guardar resultado</button>
                </form>
                <DataTable
                  headers={['Partido', 'Fecha', 'Resultado', 'Ganador', 'Puntos', 'Acciones']}
                  rows={partidos.map((partido, index) => [
                    `Partido ${index + 1}`,
                    `${partido.fecha} ${formatTime(partido.hora)} - ${partido.lugar}`,
                    formatSets(partido),
                    partido.ganador_nombre || '-',
                    `${partido.equipo_local_nombre}: ${partido.puntos_local} / ${partido.equipo_visitante_nombre}: ${partido.puntos_visitante}`,
                    <div key={`partido-${partido.id}`} className="row-actions">
                      <button type="button" onClick={() => handleEditPartido(partido)}>Editar</button>
                      <button type="button" onClick={() => {
                        setResultadoForm({ ...resultadoForm, partido: String(partido.id) });
                        setNotice('Partido seleccionado para cargar resultado.');
                      }}>
                        Resultado
                      </button>
                      <button type="button" className="danger" onClick={() => handleDeletePartido(partido)}>Eliminar</button>
                    </div>,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'posiciones' && (
              <Panel title="Posiciones" subtitle="Tabla calculada desde partidos finalizados.">
                <DataTable
                  headers={['Pos', 'Equipo', 'Campeonato', 'PJ', 'PG', 'PP', 'SF', 'SC', 'PF', 'PC', 'DIF', 'PTS']}
                  rows={posiciones.map((row) => [
                    row.posicion,
                    row.equipo_nombre,
                    row.torneo_nombre,
                    row.pj,
                    row.pg,
                    row.pp,
                    row.sf,
                    row.sc,
                    row.pf,
                    row.pc,
                    row.dif,
                    row.pts,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'credenciales' && (
              <Panel title="Credenciales" subtitle="Genera credenciales para jugadores o delegados.">
                <div className="credential-generator">
                  <select value={selectedEquipoCredencial} onChange={(e) => setSelectedEquipoCredencial(e.target.value)}>
                    <option value="">Seleccionar equipo para PDF</option>
                    {equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>)}
                  </select>
                  <button
                    className="action-btn primary"
                    type="button"
                    onClick={() => handleGenerateTeamCredentials(selectedEquipoCredencial)}
                  >
                    Generar PDF del equipo
                  </button>
                </div>
                <form
                  className="dashboard-form"
                  onSubmit={(event) => handleSave(event, api.createCredencial, cleanCredencial(credencialForm), () => setCredencialForm(initialCredencial), 'Credencial creada correctamente.')}
                >
                  <select value={credencialForm.torneo} onChange={(e) => setCredencialForm({ ...credencialForm, torneo: e.target.value })} required>
                    <option value="">Seleccionar torneo</option>
                    {torneos.map((torneo) => <option key={torneo.id} value={torneo.id}>{torneo.nombre}</option>)}
                  </select>
                  <select value={credencialForm.tipo} onChange={(e) => setCredencialForm({ ...credencialForm, tipo: e.target.value })}>
                    <option value="JUGADOR">Jugador</option>
                    <option value="DELEGADO">Delegado</option>
                    <option value="ARBITRO">Arbitro</option>
                  </select>
                  <select value={credencialForm.jugador} onChange={(e) => setCredencialForm({ ...credencialForm, jugador: e.target.value })}>
                    <option value="">Sin jugador</option>
                    {jugadores.map((jugador) => <option key={jugador.id} value={jugador.id}>{jugador.nombre} {jugador.apellido}</option>)}
                  </select>
                  <input placeholder="Observacion" value={credencialForm.observacion} onChange={(e) => setCredencialForm({ ...credencialForm, observacion: e.target.value })} />
                  <button className="action-btn primary" disabled={saving}>Generar credencial</button>
                </form>
                <DataTable
                  headers={['Codigo', 'Tipo', 'Campeonato', 'Jugador', 'Acciones']}
                  rows={credenciales.map((credencial) => {
                    const jugador = jugadores.find((item) => String(item.id) === String(credencial.jugador));
                    const equipo = jugador ? equipoById[String(jugador.equipo)] : null;
                    return [
                      credencial.codigo,
                      credencial.tipo,
                      torneoById[String(credencial.torneo)]?.nombre || 'Sin torneo',
                      jugador ? `${jugador.nombre} ${jugador.apellido}` : 'General',
                      <div key={`credencial-${credencial.id}`} className="row-actions">
                        {equipo && (
                          <button type="button" onClick={() => handleGenerateTeamCredentials(equipo.id)}>
                            Reimprimir equipo
                          </button>
                        )}
                        <button type="button" className="danger" onClick={() => handleDeleteCredencial(credencial)}>Eliminar</button>
                      </div>,
                    ];
                  })}
                />
              </Panel>
            )}

            {activeMenu === 'usuarios' && (
              <Panel title="Usuarios" subtitle="Crea y administra cuentas de administradores, entrenadores y delegados.">
                <form className="dashboard-form" onSubmit={handleSaveUsuario}>
                  <input placeholder="Usuario" value={usuarioForm.username} onChange={(e) => setUsuarioForm({ ...usuarioForm, username: e.target.value })} required />
                  <input placeholder={editingUsuarioId ? 'Nueva contraseña opcional' : 'Contraseña'} type="password" value={usuarioForm.password} onChange={(e) => setUsuarioForm({ ...usuarioForm, password: e.target.value })} required={!editingUsuarioId} />
                  <select value={usuarioForm.rol} onChange={(e) => setUsuarioForm({ ...usuarioForm, rol: e.target.value })}>
                    <option value="ENTRENADOR">Entrenador</option>
                    <option value="DELEGADO">Delegado</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                  <input placeholder="Nombre" value={usuarioForm.first_name} onChange={(e) => setUsuarioForm({ ...usuarioForm, first_name: e.target.value })} />
                  <input placeholder="Apellido" value={usuarioForm.last_name} onChange={(e) => setUsuarioForm({ ...usuarioForm, last_name: e.target.value })} />
                  <input placeholder="Numero de celular" type="tel" value={usuarioForm.telefono} onChange={(e) => setUsuarioForm({ ...usuarioForm, telefono: e.target.value })} required />
                  <button className="action-btn primary" disabled={saving}>
                    {editingUsuarioId ? 'Actualizar usuario' : 'Crear usuario'}
                  </button>
                  {editingUsuarioId && (
                    <button className="action-btn" type="button" onClick={() => {
                      setEditingUsuarioId(null);
                      setUsuarioForm(initialUsuario);
                    }}>
                      Cancelar edicion
                    </button>
                  )}
                </form>
                <DataTable
                  headers={['Usuario', 'Nombre', 'Celular', 'Rol', 'Acciones']}
                  rows={usuarios.map((usuario) => [
                    usuario.username,
                    `${usuario.first_name || ''} ${usuario.last_name || ''}`.trim() || '-',
                    usuario.telefono || '-',
                    usuario.rol,
                    <div key={`usuario-${usuario.id}`} className="row-actions">
                      <button type="button" onClick={() => handleEditUsuario(usuario)}>Editar</button>
                      <button type="button" className="danger" onClick={() => handleDeleteUsuario(usuario.id)}>Eliminar</button>
                    </div>,
                  ])}
                />
              </Panel>
            )}
          </section>
        </main>
      </div>
    </div>
    <DashboardConfirmModal {...(confirmModal || {})} />
    </>
  );
}

function StatCard({ icon, title, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <h3>{title}</h3>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="data-panel">
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function GuideBox({ title, items }) {
  return (
    <div className="guide-box">
      <h4>{title}</h4>
      <ol>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ol>
    </div>
  );
}

function Field({ label, help, children }) {
  return (
    <label className="form-field">
      <span className="field-label">{label}</span>
      {children}
      <small>{help}</small>
    </label>
  );
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '-';
}

function DataTable({ headers, rows }) {
  if (!rows.length) {
    return <EmptyState text="Todavia no hay registros para mostrar." />;
  }

  return (
    <div className="table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            {headers.map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.join('-')}-${rowIndex}`}>
              {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell || '-'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function formatSets(partido) {
  if (!partido.sets?.length) return '-';
  return partido.sets
    .map((set) => `${set.puntos_local}-${set.puntos_visitante}`)
    .join(' / ');
}

function getTeamLogoSrc(equipo) {
  return equipo?.logo_data_url || '';
}

function getPlayerPhotoSrc(jugador) {
  return jugador?.foto_data_url || (jugador?.foto ? getMediaUrl(jugador.foto) : '');
}

function buildUsuarioPayload(form) {
  const username = String(form.username || '').trim();
  const fallbackEmail = `${username || 'usuario'}@ayacucho.local`.toLowerCase();

  return {
    ...form,
    username,
    email: form.email || fallbackEmail,
    telefono: String(form.telefono || '').trim(),
  };
}

function getApiErrorMessage(error, fallback) {
  const raw = error?.message || '';

  try {
    const parsed = JSON.parse(raw);
    if (parsed.detail) return parsed.detail;
    return Object.values(parsed).flat().join(' ');
  } catch {
    return raw || fallback;
  }
}

function cleanCredencial(form) {
  return {
    torneo: form.torneo,
    tipo: form.tipo,
    observacion: form.observacion,
    ...(form.jugador ? { jugador: form.jugador } : {}),
  };
}

function buildCredentialCode(equipo, jugador) {
  const raw = `${equipo.id}-${jugador.id}-${jugador.documento}-AYACUCHO-2023`;
  const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/=+$/g, '').slice(-10);
  return `AYA-${equipo.id}-${jugador.id}-${encoded}`;
}

async function downloadCredentialsPdf({ equipo, torneo, cards }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const logoData = await toDataUrl(clubLogo);
  const enrichedCards = await Promise.all(cards.map(async (card) => ({
    ...card,
    photoData: card.jugador.foto_data_url || (card.jugador.foto ? await toDataUrl(getMediaUrl(card.jugador.foto)).catch(() => null) : null),
  })));
  const pageCards = chunk(enrichedCards, 8);

  pageCards.forEach((page, pageIndex) => {
    if (pageIndex > 0) doc.addPage('a4', 'portrait');

    page.forEach((card, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 10 + col * 99;
      const y = 10 + row * 70;
      drawCredentialCard(doc, {
        x,
        y,
        width: 90,
        height: 62,
        logoData,
        torneo,
        equipo,
        ...card,
      });
    });
  });

  doc.save(`credenciales-${slugify(equipo.nombre)}.pdf`);
}

async function downloadFixturePdf({ torneo, partidos }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const logoData = await toDataUrl(clubLogo);
  const pageWidth = 210;
  const margin = 14;
  const title = torneo?.nombre || partidos[0]?.torneo_nombre || 'Fixture';
  let y = 18;

  doc.setFillColor(15, 15, 16);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(178, 17, 25);
  doc.rect(0, 28, pageWidth, 6, 'F');
  doc.addImage(logoData, 'PNG', margin, 7, 18, 18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AYACUCHO CLUB DE VOLEIBOL', 36, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Fixture oficial para compartir con los equipos', 36, 23);

  y = 45;
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text(`Partidos programados: ${partidos.length}`, margin, y + 6);

  y += 16;
  drawFixtureHeader(doc, y);
  y += 8;

  partidos
    .slice()
    .sort((a, b) => Number(a.orden) - Number(b.orden))
    .forEach((partido) => {
      if (y > 277) {
        doc.addPage();
        y = 18;
        drawFixtureHeader(doc, y);
        y += 8;
      }

      const rowHeight = 10;
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y + rowHeight - 2, pageWidth - margin, y + rowHeight - 2);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.3);
      doc.text(`P${partido.orden}`, margin, y + 4.8);
      doc.text(String(partido.ronda), margin + 16, y + 4.8);
      doc.text(String(partido.fecha), margin + 30, y + 4.8);
      doc.text(formatTime(partido.hora), margin + 58, y + 4.8);
      doc.text(String(partido.lugar || '-'), margin + 78, y + 4.8, { maxWidth: 34 });
      doc.text(`${partido.equipo_local_nombre} vs ${partido.equipo_visitante_nombre}`, margin + 116, y + 4.8, { maxWidth: 60 });

      y += rowHeight;
    });

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(7.5);
  doc.text('Documento generado desde el Sistema de Torneos Ayacucho Club de Voleibol.', margin, 290);
  doc.save(`fixture-${slugify(title)}.pdf`);
}

function drawFixtureHeader(doc, y) {
  const margin = 14;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y - 5, 182, 8, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.7);
  doc.text('ORDEN', margin, y);
  doc.text('RONDA', margin + 16, y);
  doc.text('FECHA', margin + 30, y);
  doc.text('HORA', margin + 58, y);
  doc.text('LUGAR', margin + 78, y);
  doc.text('PARTIDO', margin + 116, y);
}

function drawCredentialCard(doc, { x, y, width, height, logoData, photoData, qr, jugador, equipo, torneo }) {
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(x, y, width, height, 3.5, 3.5, 'F');
  doc.setFillColor(15, 15, 16);
  doc.roundedRect(x + 2, y + 2, width - 4, height - 4, 2.6, 2.6, 'F');
  doc.setFillColor(126, 5, 8);
  doc.triangle(x + width, y + 2, x + width, y + height - 2, x + width - 35, y + height - 2, 'F');
  doc.setFillColor(198, 16, 18);
  doc.triangle(x + width, y + 34, x + width, y + height - 2, x + width - 44, y + height - 2, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.35);
  doc.roundedRect(x + 4.5, y + 4.5, width - 9, height - 9, 2, 2);

  drawWatermarkLogo(doc, logoData, x + 34, y + 15, 34, 34);

  doc.addImage(logoData, 'PNG', x + 7, y + 7, 14, 14);
  doc.setTextColor(255, 46, 54);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.8);
  doc.text('AYACUCHO', x + 24, y + 12.5);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.2);
  doc.text('CLUB DE VOLEIBOL', x + 24, y + 18.2);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + 7, y + 23, 23, 23, 1.2, 1.2, 'F');
  if (photoData) {
    doc.addImage(photoData, getImageFormat(photoData), x + 8, y + 24, 21, 21);
  } else {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('FOTO', x + 14.5, y + 38);
  }
  doc.setDrawColor(203, 213, 225);
  doc.rect(x + 8, y + 24, 21, 21);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + 33, y + 23, 36, 23, 2, 2, 'F');
  doc.setDrawColor(230, 235, 242);
  doc.roundedRect(x + 33, y + 23, 36, 23, 2, 2);
  doc.setFillColor(178, 17, 25);
  doc.roundedRect(x + 35, y + 25, 19, 4, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.8);
  doc.text(jugador.tipo_persona === 'ENTRENADOR' ? 'ENTRENADOR' : 'JUGADOR', x + 36.5, y + 27.7, { maxWidth: 17 });
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.4);
  doc.text(`${jugador.nombre} ${jugador.apellido}`.toUpperCase(), x + 35, y + 34.5, { maxWidth: 31 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.3);
  doc.text(`CI: ${jugador.documento}`, x + 35, y + 41.5);
  doc.text(`Posicion: ${jugador.posicion}`, x + 51, y + 41.5);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + width - 20.5, y + 22, 15.5, 15.5, 1.2, 1.2, 'F');
  doc.addImage(qr, 'PNG', x + width - 19.8, y + 22.7, 14.1, 14.1);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.1);
  doc.text('VERIFICACION QR', x + width - 21, y + 40.2, { maxWidth: 18 });

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + 8, y + height - 13.5, width - 16, 7, 1.4, 1.4, 'F');
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.text(`Equipo: ${equipo.nombre}`, x + 10, y + height - 9.5, { maxWidth: 34 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.text(`Torneo: ${torneo?.nombre || 'Sin torneo'}`, x + 45, y + height - 9.5, { maxWidth: 29 });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(2.5);
  doc.text('AYACUCHO CLUB DE VOLEIBOL · DOCUMENTO OFICIAL · QR: NOMBRE Y CI', x + 7, y + height - 2.3, { maxWidth: 60 });
}

function chunk(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function drawWatermarkLogo(doc, logoData, x, y, width, height) {
  if (doc.GState) {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    doc.addImage(logoData, 'PNG', x, y, width, height);
    doc.restoreGraphicsState();
    return;
  }

  doc.setDrawColor(230, 235, 242);
  doc.setLineWidth(0.4);
  doc.circle(x + width / 2, y + height / 2, Math.min(width, height) / 2.5);
}

async function toDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getImageFormat(dataUrl) {
  if (String(dataUrl).startsWith('data:image/png')) return 'PNG';
  if (String(dataUrl).startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function slugify(value) {
  return String(value || 'equipo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
