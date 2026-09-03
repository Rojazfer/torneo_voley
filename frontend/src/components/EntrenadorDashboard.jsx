import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { getMediaUrl } from '../services/api';
import { DashboardConfirmModal } from './DashboardModal';
import FixtureMatch from './FixtureMatch';
import { compressPlayerPhoto, compressTeamLogo } from '../utils/imageCompression';
import clubLogo from '../assets/club-logo.png';
import '../styles/Dashboard.css';

const coachMenu = [
  { id: 'resumen', icon: 'IN', label: 'Inicio' },
  { id: 'equipo', icon: 'EQ', label: 'Equipo' },
  { id: 'jugadores', icon: 'PL', label: 'Jugadores' },
  { id: 'fixture', icon: 'FX', label: 'Fixture' },
  { id: 'resultados', icon: 'RS', label: 'Resultados' },
  { id: 'posiciones', icon: 'TB', label: 'Posiciones' },
];

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

export default function EntrenadorDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeMenu, setActiveMenu] = useState('resumen');
  const [torneos, setTorneos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [posiciones, setPosiciones] = useState([]);
  const [equipoForm, setEquipoForm] = useState(initialEquipo);
  const [jugadorForm, setJugadorForm] = useState(initialJugador);
  const [equipoLogoNombre, setEquipoLogoNombre] = useState('');
  const [fotoNombre, setFotoNombre] = useState('');
  const [editingJugadorId, setEditingJugadorId] = useState(null);
  const [selectedEquipo, setSelectedEquipo] = useState('');
  const [selectedTorneo, setSelectedTorneo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);

  const torneoById = useMemo(() => {
    return Object.fromEntries(torneos.map((torneo) => [String(torneo.id), torneo]));
  }, [torneos]);

  const equipoById = useMemo(() => {
    return Object.fromEntries(equipos.map((equipo) => [String(equipo.id), equipo]));
  }, [equipos]);

  const equipoActual = useMemo(() => {
    return equipos.find((equipo) => String(equipo.id) === String(selectedEquipo));
  }, [equipos, selectedEquipo]);

  const torneoActual = useMemo(() => {
    return torneoById[String(selectedTorneo || equipoActual?.torneo)] || null;
  }, [equipoActual, selectedTorneo, torneoById]);

  const jugadoresEquipo = useMemo(() => {
    if (!selectedEquipo) return [];
    return jugadores.filter((jugador) => String(jugador.equipo) === String(selectedEquipo));
  }, [jugadores, selectedEquipo]);

  const equiposTorneo = useMemo(() => {
    if (!torneoActual) return [];
    return equipos.filter((equipo) => String(equipo.torneo) === String(torneoActual.id));
  }, [equipos, torneoActual]);

  const partidosTorneo = useMemo(() => {
    if (!torneoActual) return [];
    return partidos
      .filter((partido) => String(partido.torneo) === String(torneoActual.id))
      .slice()
      .sort(sortPartidos);
  }, [partidos, torneoActual]);

  const partidosEquipo = useMemo(() => {
    if (!selectedEquipo) return [];
    return partidosTorneo.filter((partido) => isPartidoDelEquipo(partido, selectedEquipo));
  }, [partidosTorneo, selectedEquipo]);

  const posicionesTorneo = useMemo(() => {
    if (!torneoActual) return [];
    return posiciones.filter((row) => String(row.torneo) === String(torneoActual.id));
  }, [posiciones, torneoActual]);

  const posicionEquipo = useMemo(() => {
    if (!selectedEquipo) return null;
    return posicionesTorneo.find((row) => String(row.equipo) === String(selectedEquipo)) || null;
  }, [posicionesTorneo, selectedEquipo]);

  const proximosPartidos = useMemo(() => {
    return partidosEquipo.filter((partido) => partido.estado !== 'FINALIZADO').slice(0, 3);
  }, [partidosEquipo]);

  const refreshData = useCallback(async () => {
    const [torneosData, equiposData, jugadoresData, partidosData, posicionesData] = await Promise.all([
      api.getTorneos(),
      api.getEquipos(),
      api.getJugadores(),
      api.getPartidos(),
      api.getPosiciones(),
    ]);

    setTorneos(torneosData);
    setEquipos(equiposData);
    setJugadores(jugadoresData);
    setPartidos(partidosData);
    setPosiciones(posicionesData);

    const nextEquipo = selectedEquipo
      ? equiposData.find((equipo) => String(equipo.id) === String(selectedEquipo))
      : equiposData[0];

    if (nextEquipo) {
      setSelectedEquipo(String(nextEquipo.id));
      setSelectedTorneo(String(nextEquipo.torneo));
      setJugadorForm((current) => ({
        ...current,
        equipo: String(nextEquipo.id),
        torneo: nextEquipo.torneo,
      }));
    } else if (torneosData.length && !selectedTorneo) {
      setSelectedTorneo(String(torneosData[0].id));
    }
  }, [selectedEquipo, selectedTorneo]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await refreshData();
      } catch (err) {
        setError('No se pudo cargar el panel del entrenador.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refreshData]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const openSection = (section) => {
    setActiveMenu(section);
    setError('');
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

  const handleCreateEquipo = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const equipo = await api.createEquipo(equipoForm);
      setSelectedEquipo(String(equipo.id));
      setSelectedTorneo(String(equipo.torneo));
      setJugadorForm({ ...initialJugador, equipo: String(equipo.id), torneo: equipo.torneo });
      setEquipoForm(initialEquipo);
      setEquipoLogoNombre('');
      await refreshData();
      setNotice('Equipo registrado correctamente.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo registrar el equipo. Revisa los datos.'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const resetJugadorForm = () => {
    setJugadorForm({
      ...initialJugador,
      equipo: selectedEquipo,
      torneo: equipoActual?.torneo || selectedTorneo || '',
    });
    setFotoNombre('');
    setEditingJugadorId(null);
  };

  const handleSaveJugador = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (editingJugadorId) {
        await api.updateJugador(editingJugadorId, jugadorForm);
        setNotice('Registro actualizado correctamente.');
      } else {
        await api.createJugador(jugadorForm);
        setNotice('Registro creado correctamente.');
      }

      resetJugadorForm();
      await refreshData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar el registro. Revisa documento, equipo y fecha.'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditJugador = (jugador) => {
    setActiveMenu('jugadores');
    setEditingJugadorId(jugador.id);
    setFotoNombre('');
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
      setError(err.message || 'No se pudo procesar el logo.');
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
      setFotoNombre(file.name);
      setJugadorForm((current) => ({ ...current, foto: null, foto_data_url: fotoDataUrl }));
      setError('');
    } catch (err) {
      setError(err.message || 'No se pudo procesar la foto.');
    }
  };

  const handleDeleteJugador = async (jugadorId) => {
    const confirmed = await requestConfirmation({
      title: 'Eliminar registro',
      message: 'Eliminar este registro?',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;

    setError('');
    setNotice('');

    try {
      await api.deleteJugador(jugadorId);
      if (editingJugadorId === jugadorId) {
        resetJugadorForm();
      }
      await refreshData();
      setNotice('Registro eliminado correctamente.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar el registro.'));
      console.error(err);
    }
  };

  const handleEquipoChange = (equipoId) => {
    const equipo = equipos.find((item) => String(item.id) === String(equipoId));
    setSelectedEquipo(equipoId);
    setSelectedTorneo(equipo ? String(equipo.torneo) : selectedTorneo);
    setJugadorForm((current) => ({
      ...current,
      equipo: equipoId,
      torneo: equipo?.torneo || selectedTorneo || '',
    }));
  };

  const handleTorneoChange = (torneoId) => {
    const equipoDelTorneo = equipos.find((equipo) => String(equipo.torneo) === String(torneoId));
    setSelectedTorneo(torneoId);
    if (equipoDelTorneo) {
      handleEquipoChange(String(equipoDelTorneo.id));
    }
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
    <div className="dashboard-container coach-dashboard">
      <header className="dashboard-header coach-header">
        <div className="header-content">
          <div className="brand-lockup">
            <img src={clubLogo} alt="Ayacucho Club de Voleibol" className="club-logo" />
            <div>
              <h1>AYACUCHO CLUB DE VOLEIBOL</h1>
              <p>Panel de Entrenador</p>
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
            {coachMenu.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeMenu === item.id ? 'active' : ''}`}
                onClick={() => openSection(item.id)}
                type="button"
              >
                <span className="nav-badge">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="dashboard-content">
          {error && <div className="error">{error}</div>}
          {notice && <div className="success-message">{notice}</div>}

          <section className="welcome-section coach-welcome">
            <div>
              <h2>Bienvenido, Entrenador</h2>
              <p>{equipoActual ? `Gestionas ${equipoActual.nombre} en ${torneoActual?.nombre || 'el campeonato'}.` : 'Selecciona o registra un equipo para consultar fixture, puntos y tabla.'}</p>
            </div>
            <div className="coach-selector">
              <select value={selectedTorneo} onChange={(event) => handleTorneoChange(event.target.value)}>
                <option value="">Seleccionar campeonato</option>
                {torneos.map((torneo) => <option key={torneo.id} value={torneo.id}>{torneo.nombre}</option>)}
              </select>
              <select value={selectedEquipo} onChange={(event) => handleEquipoChange(event.target.value)}>
                <option value="">Seleccionar equipo</option>
                {equipos
                  .filter((equipo) => !selectedTorneo || String(equipo.torneo) === String(selectedTorneo))
                  .map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>)}
              </select>
            </div>
          </section>

          <section className="stats-section">
            <StatCard icon="EQ" title="Equipos torneo" value={equiposTorneo.length} />
            <StatCard icon="PL" title="Plantilla" value={jugadoresEquipo.length} />
            <StatCard icon="FX" title="Partidos" value={partidosEquipo.length || partidosTorneo.length} />
            <StatCard icon="TB" title="Posicion" value={posicionEquipo?.posicion || '-'} />
            <StatCard icon="PT" title="Puntos" value={posicionEquipo?.pts ?? 0} />
          </section>

          <section className="actions-section coach-actions">
            <h3>Menus rapidos</h3>
            <div className="action-buttons">
              <button className="action-btn primary" type="button" onClick={() => openSection('equipo')}>Registrar equipo</button>
              <button className="action-btn" type="button" onClick={() => openSection('jugadores')}>Gestionar jugadores</button>
              <button className="action-btn" type="button" onClick={() => openSection('fixture')}>Ver fixture real</button>
              <button className="action-btn" type="button" onClick={() => openSection('posiciones')}>Ver posiciones</button>
            </div>
          </section>

          <section className="panel-section">
            {activeMenu === 'resumen' && (
              <Panel title="Resumen del equipo" subtitle="Datos cargados desde partidos y tabla real del campeonato.">
                <div className="coach-overview">
                  <div className="coach-summary wide">
                    <div>
                      <span>Equipo</span>
                      <strong>{equipoActual?.nombre || 'Sin equipo'}</strong>
                    </div>
                    <div>
                      <span>Campeonato</span>
                      <strong>{torneoActual?.nombre || 'Sin campeonato'}</strong>
                    </div>
                    <div>
                      <span>Partidos jugados</span>
                      <strong>{posicionEquipo?.pj ?? 0}</strong>
                    </div>
                    <div>
                      <span>Ganados / Perdidos</span>
                      <strong>{posicionEquipo ? `${posicionEquipo.pg} / ${posicionEquipo.pp}` : '0 / 0'}</strong>
                    </div>
                  </div>

                  <div className="coach-mini-section">
                    <h4>Proximos partidos</h4>
                    <DataTable
                      headers={['Fecha', 'Hora', 'Partido', 'Lugar', 'Estado']}
                      rows={proximosPartidos.map((partido) => [
                        partido.fecha,
                        formatTime(partido.hora),
                        <FixtureMatch key={`proximo-${partido.id}`} partido={partido} equiposById={equipoById} highlightEquipoId={selectedEquipo} />,
                        partido.lugar,
                        partido.estado,
                      ])}
                    />
                  </div>
                </div>
              </Panel>
            )}

            {activeMenu === 'equipo' && (
              <Panel title="Registrar equipo" subtitle="Crea o selecciona el equipo que vas a dirigir en el torneo.">
                <form className="dashboard-form" onSubmit={handleCreateEquipo}>
                  <input placeholder="Nombre del equipo" value={equipoForm.nombre} onChange={(e) => setEquipoForm({ ...equipoForm, nombre: e.target.value })} required />
                  <input placeholder="Categoria" value={equipoForm.categoria} onChange={(e) => setEquipoForm({ ...equipoForm, categoria: e.target.value })} required />
                  <select value={equipoForm.torneo} onChange={(e) => setEquipoForm({ ...equipoForm, torneo: e.target.value })} required>
                    <option value="">Seleccionar campeonato</option>
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
                  <button className="action-btn primary" disabled={saving}>Guardar equipo</button>
                </form>

                <DataTable
                  headers={['Logo', 'Equipo', 'Campeonato', 'Categoria', 'Jugadores']}
                  rows={equiposTorneo.map((equipo) => [
                    getTeamLogoSrc(equipo) ? <img key={`logo-${equipo.id}`} className="team-logo-thumb" src={getTeamLogoSrc(equipo)} alt={equipo.nombre} /> : '-',
                    <strong key={`team-${equipo.id}`} className={String(equipo.id) === String(selectedEquipo) ? 'highlight-text' : ''}>{equipo.nombre}</strong>,
                    torneoById[String(equipo.torneo)]?.nombre || '-',
                    equipo.categoria,
                    jugadores.filter((jugador) => String(jugador.equipo) === String(equipo.id)).length,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'jugadores' && (
              <Panel title="Jugadores" subtitle="Agrega y administra jugadores del equipo seleccionado.">
                <form className="dashboard-form" onSubmit={handleSaveJugador}>
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
                  <label className="file-input-label">
                    <span>{fotoNombre || 'Foto del jugador'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleJugadorFotoChange}
                    />
                  </label>
                  <button className="action-btn primary" disabled={saving || !selectedEquipo}>
                    {editingJugadorId ? 'Actualizar registro' : 'Guardar jugador'}
                  </button>
                  {editingJugadorId && (
                    <button className="action-btn" type="button" onClick={resetJugadorForm}>
                      Cancelar edicion
                    </button>
                  )}
                </form>

                <DataTable
                  headers={['Jugador', 'Foto', 'Tipo', 'Documento', 'Posicion', 'Estado', 'Acciones']}
                  rows={jugadoresEquipo.map((jugador) => [
                    `${jugador.nombre} ${jugador.apellido}`,
                    getPlayerPhotoSrc(jugador) ? <img key={`foto-${jugador.id}`} className="player-thumb" src={getPlayerPhotoSrc(jugador)} alt={`${jugador.nombre} ${jugador.apellido}`} /> : '-',
                    jugador.tipo_persona || 'JUGADOR',
                    jugador.documento,
                    jugador.posicion,
                    jugador.activo ? 'Activo' : 'Inactivo',
                    <div key={`jugador-${jugador.id}`} className="row-actions">
                      <button type="button" onClick={() => handleEditJugador(jugador)}>Editar</button>
                      <button type="button" className="danger" onClick={() => handleDeleteJugador(jugador.id)}>Eliminar</button>
                    </div>,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'fixture' && (
              <Panel title="Fixture real" subtitle="Partidos programados del campeonato seleccionado.">
                <DataTable
                  headers={['Orden', 'Ronda', 'Fecha', 'Hora', 'Lugar', 'Partido', 'Estado']}
                  rows={partidosTorneo.map((partido) => [
                    `Partido ${partido.orden}`,
                    partido.ronda,
                    partido.fecha,
                    formatTime(partido.hora),
                    partido.lugar,
                    <FixtureMatch key={`fixture-${partido.id}`} partido={partido} equiposById={equipoById} highlightEquipoId={selectedEquipo} />,
                    partido.estado,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'resultados' && (
              <Panel title="Resultados y puntos" subtitle="Marcadores por set, ganador y puntos asignados a la tabla.">
                <DataTable
                  headers={['Fecha', 'Partido', 'Sets', 'Ganador', 'Puntos']}
                  rows={partidosTorneo.map((partido) => [
                    `${partido.fecha} ${formatTime(partido.hora)}`,
                    <span key={`resultado-${partido.id}`} className={isPartidoDelEquipo(partido, selectedEquipo) ? 'highlight-text' : ''}>{formatPartido(partido)}</span>,
                    formatSets(partido),
                    partido.ganador_nombre || '-',
                    `${partido.equipo_local_nombre}: ${partido.puntos_local} / ${partido.equipo_visitante_nombre}: ${partido.puntos_visitante}`,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'posiciones' && (
              <Panel title="Tabla de posiciones" subtitle="Tabla calculada desde partidos finalizados.">
                <DataTable
                  headers={['Pos', 'Equipo', 'PJ', 'PG', 'PP', 'SF', 'SC', 'PF', 'PC', 'DIF', 'PTS']}
                  rows={posicionesTorneo.map((row) => [
                    row.posicion,
                    <strong key={`pos-${row.equipo}`} className={String(row.equipo) === String(selectedEquipo) ? 'highlight-text' : ''}>{row.equipo_nombre}</strong>,
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
      <div className="stat-icon text-icon">{icon}</div>
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

function DataTable({ headers, rows }) {
  if (!rows.length) {
    return <EmptyState text="Todavia no hay registros reales para mostrar." />;
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
            <tr key={buildRowKey(row, rowIndex)}>
              {row.map((cell, cellIndex) => <td key={`${cellIndex}-${buildCellKey(cell)}`}>{renderCell(cell)}</td>)}
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

function sortPartidos(a, b) {
  const byDate = String(a.fecha || '').localeCompare(String(b.fecha || ''));
  if (byDate !== 0) return byDate;
  const byTime = String(a.hora || '').localeCompare(String(b.hora || ''));
  if (byTime !== 0) return byTime;
  return Number(a.orden || 0) - Number(b.orden || 0);
}

function isPartidoDelEquipo(partido, equipoId) {
  if (!equipoId) return false;
  return String(partido.equipo_local) === String(equipoId) || String(partido.equipo_visitante) === String(equipoId);
}

function formatPartido(partido) {
  return `${partido.equipo_local_nombre} vs ${partido.equipo_visitante_nombre}`;
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '-';
}

function formatSets(partido) {
  if (!partido.sets?.length) return '-';
  return partido.sets
    .map((set) => `${set.puntos_local}-${set.puntos_visitante}`)
    .join(' / ');
}

function buildRowKey(row, rowIndex) {
  return `${row.map(buildCellKey).join('-')}-${rowIndex}`;
}

function buildCellKey(cell) {
  if (typeof cell === 'string' || typeof cell === 'number') return cell;
  return cell?.key || 'cell';
}

function renderCell(cell) {
  if (cell === '' || cell === null || cell === undefined) return '-';
  return cell;
}

function getTeamLogoSrc(equipo) {
  return equipo?.logo_data_url || '';
}

function getPlayerPhotoSrc(jugador) {
  return jugador?.foto_data_url || (jugador?.foto ? getMediaUrl(jugador.foto) : '');
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
