import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { getMediaUrl } from '../services/api';
import FixtureMatch from './FixtureMatch';
import { compressPlayerPhoto, compressTeamLogo } from '../utils/imageCompression';
import clubLogo from '../assets/club-logo.png';
import '../styles/Dashboard.css';

const delegadoMenu = [
  { id: 'equipo', icon: '👥', label: 'Mi equipo' },
  { id: 'jugadores', icon: '🏐', label: 'Jugadores' },
  { id: 'fixture', icon: '🗓️', label: 'Fixture' },
  { id: 'resultados', icon: '📋', label: 'Resultados' },
  { id: 'posiciones', icon: '📊', label: 'Posiciones' },
  { id: 'credenciales', icon: '🪪', label: 'Credenciales' },
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

export default function DelegadoDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeMenu, setActiveMenu] = useState('equipo');
  const [torneos, setTorneos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [posiciones, setPosiciones] = useState([]);
  const [credenciales, setCredenciales] = useState([]);
  const [equipoForm, setEquipoForm] = useState(initialEquipo);
  const [jugadorForm, setJugadorForm] = useState(initialJugador);
  const [equipoLogoNombre, setEquipoLogoNombre] = useState('');
  const [jugadorFotoNombre, setJugadorFotoNombre] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const miEquipo = equipos[0] || null;
  const torneoActual = torneos.find((torneo) => String(torneo.id) === String(miEquipo?.torneo));

  const equipoById = useMemo(() => {
    return Object.fromEntries(equipos.map((equipo) => [String(equipo.id), equipo]));
  }, [equipos]);

  const misPartidos = useMemo(() => {
    if (!miEquipo) return [];
    return partidos.filter((partido) => (
      String(partido.equipo_local) === String(miEquipo.id)
      || String(partido.equipo_visitante) === String(miEquipo.id)
      || String(partido.torneo) === String(miEquipo.torneo)
    ));
  }, [miEquipo, partidos]);

  const posicionesTorneo = useMemo(() => {
    if (!miEquipo) return [];
    return posiciones.filter((row) => String(row.torneo) === String(miEquipo.torneo));
  }, [miEquipo, posiciones]);

  const refreshData = async () => {
    const [torneosData, equiposData, jugadoresData, partidosData, posicionesData, credencialesData] = await Promise.all([
      api.getTorneos(),
      api.getEquipos(),
      api.getJugadores(),
      api.getPartidos(),
      api.getPosiciones(),
      api.getCredenciales(),
    ]);

    setTorneos(torneosData);
    setEquipos(equiposData);
    setJugadores(jugadoresData);
    setPartidos(partidosData);
    setPosiciones(posicionesData);
    setCredenciales(credencialesData);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await refreshData();
      } catch (err) {
        setError('No se pudo cargar el panel del delegado.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (miEquipo) {
      setJugadorForm((current) => ({
        ...current,
        equipo: miEquipo.id,
        torneo: miEquipo.torneo,
      }));
    }
  }, [miEquipo]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const handleCreateEquipo = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api.createEquipo(equipoForm);
      setEquipoForm(initialEquipo);
      setEquipoLogoNombre('');
      await refreshData();
      setNotice('Equipo registrado correctamente. Ya no podras registrar otro equipo en este campeonato.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo registrar el equipo.'));
      console.error(err);
    } finally {
      setSaving(false);
    }
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
      setJugadorFotoNombre(file.name);
      setJugadorForm((current) => ({ ...current, foto: null, foto_data_url: fotoDataUrl }));
      setError('');
    } catch (err) {
      setError(err.message || 'No se pudo procesar la foto.');
    }
  };

  const handleCreateJugador = async (event) => {
    event.preventDefault();

    if (!miEquipo) {
      setError('Primero registra tu equipo.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api.createJugador({
        ...jugadorForm,
        equipo: miEquipo.id,
        torneo: miEquipo.torneo,
      });
      setJugadorForm({ ...initialJugador, equipo: miEquipo.id, torneo: miEquipo.torneo });
      setJugadorFotoNombre('');
      await refreshData();
      setNotice('Jugador registrado correctamente.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo registrar el jugador.'));
      console.error(err);
    } finally {
      setSaving(false);
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
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="brand-lockup">
            <img src={clubLogo} alt="Ayacucho Club de Voleibol" className="club-logo" />
            <div>
              <h1>AYACUCHO CLUB DE VOLEIBOL</h1>
              <p>Panel del Delegado</p>
            </div>
          </div>
          <div className="user-info">
            <span className="user-name">{user?.first_name || user?.username}</span>
            <button className="logout-btn" onClick={handleLogout}>Cerrar Sesion</button>
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            {delegadoMenu.map((item) => (
              <button
                className={`nav-item ${activeMenu === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id);
                  setError('');
                  setNotice('');
                }}
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
            <h2>Bienvenido, Delegado</h2>
            <p>{miEquipo ? `Gestionas el equipo ${miEquipo.nombre}.` : 'Registra tu equipo para comenzar la inscripcion.'}</p>
          </section>

          <section className="stats-section">
            <StatCard icon="👥" title="Mi equipo" value={miEquipo ? 1 : 0} />
            <StatCard icon="🏐" title="Jugadores" value={jugadores.length} />
            <StatCard icon="🗓️" title="Partidos" value={misPartidos.length} />
            <StatCard icon="📊" title="Posicion" value={getMyPosition(posicionesTorneo, miEquipo)} />
          </section>

          <section className="panel-section">
            {activeMenu === 'equipo' && (
              <Panel title="Mi equipo" subtitle="Cada delegado puede registrar un solo equipo por campeonato.">
                {!miEquipo ? (
                  <>
                    <GuideBox
                      title="Registro de equipo"
                      items={[
                        'Selecciona el campeonato donde quieres inscribirte.',
                        'Registra los datos de tu equipo.',
                        'Cuando guardes, tu usuario quedara ligado a ese equipo.',
                        'No podras registrar otro equipo en el mismo campeonato.',
                      ]}
                    />
                    <form className="dashboard-form" onSubmit={handleCreateEquipo}>
                      <Field label="Campeonato" help="Solo podras registrar un equipo en el campeonato seleccionado.">
                        <select value={equipoForm.torneo} onChange={(e) => setEquipoForm({ ...equipoForm, torneo: e.target.value })} required>
                          <option value="">Seleccionar campeonato</option>
                          {torneos.map((torneo) => <option key={torneo.id} value={torneo.id}>{torneo.nombre}</option>)}
                        </select>
                      </Field>
                      <Field label="Nombre del equipo" help="Ejemplo: Deportivo Central.">
                        <input value={equipoForm.nombre} onChange={(e) => setEquipoForm({ ...equipoForm, nombre: e.target.value })} placeholder="Nombre del equipo" required />
                      </Field>
                      <Field label="Categoria" help="Ejemplo: Mayores Masculino.">
                        <input value={equipoForm.categoria} onChange={(e) => setEquipoForm({ ...equipoForm, categoria: e.target.value })} placeholder="Categoria" required />
                      </Field>
                      <Field label="Logo del equipo" help="Se comprime automaticamente antes de guardar.">
                        <label className="image-input-label">
                          <span>{equipoLogoNombre || (equipoForm.logo_data_url ? 'Logo cargado' : 'Seleccionar logo')}</span>
                          <input type="file" accept="image/*" onChange={handleEquipoLogoChange} />
                        </label>
                      </Field>
                      {equipoForm.logo_data_url && (
                        <div className="image-preview-card">
                          <img src={equipoForm.logo_data_url} alt="Vista previa del logo" />
                          <button type="button" onClick={clearEquipoLogo}>Quitar</button>
                        </div>
                      )}
                      <button className="action-btn primary" disabled={saving}>Registrar mi equipo</button>
                    </form>
                  </>
                ) : (
                  <div className="team-list">
                    <article className="team-card">
                      {getTeamLogoSrc(miEquipo) ? <img className="team-logo-thumb large" src={getTeamLogoSrc(miEquipo)} alt={miEquipo.nombre} /> : null}
                      <div>
                        <h4>{miEquipo.nombre}</h4>
                        <p>{torneoActual?.nombre || 'Campeonato'} · {miEquipo.categoria}</p>
                        <span>{jugadores.length} jugadores registrados</span>
                      </div>
                    </article>
                  </div>
                )}
              </Panel>
            )}

            {activeMenu === 'jugadores' && (
              <Panel title="Jugadores" subtitle="Registra jugadores solo para tu equipo.">
                {!miEquipo ? <EmptyState text="Primero registra tu equipo." /> : (
                  <>
                    <form className="dashboard-form" onSubmit={handleCreateJugador}>
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
                        <span>{jugadorFotoNombre || 'Foto del jugador'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleJugadorFotoChange}
                        />
                      </label>
                      <button className="action-btn primary" disabled={saving}>Guardar jugador</button>
                    </form>
                    <DataTable
                      headers={['Jugador', 'Foto', 'Tipo', 'Documento', 'Posicion', 'Activo']}
                      rows={jugadores.map((jugador) => [
                        `${jugador.nombre} ${jugador.apellido}`,
                        getPlayerPhotoSrc(jugador) ? <img key={`foto-${jugador.id}`} className="player-thumb" src={getPlayerPhotoSrc(jugador)} alt={`${jugador.nombre} ${jugador.apellido}`} /> : '-',
                        jugador.tipo_persona,
                        jugador.documento,
                        jugador.posicion,
                        jugador.activo ? 'Si' : 'No',
                      ])}
                    />
                  </>
                )}
              </Panel>
            )}

            {activeMenu === 'fixture' && (
              <Panel title="Fixture" subtitle="Consulta los partidos programados de tu campeonato.">
                <DataTable
                  headers={['Orden', 'Ronda', 'Fecha', 'Hora', 'Lugar', 'Partido', 'Estado']}
                  rows={misPartidos.map((partido) => [
                    `Partido ${partido.orden}`,
                    partido.ronda,
                    partido.fecha,
                    formatTime(partido.hora),
                    partido.lugar,
                    <FixtureMatch key={`fixture-${partido.id}`} partido={partido} equiposById={equipoById} highlightEquipoId={miEquipo?.id} />,
                    partido.estado,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'resultados' && (
              <Panel title="Resultados" subtitle="Resultados de los partidos del campeonato.">
                <DataTable
                  headers={['Fecha', 'Partido', 'Sets', 'Ganador', 'Puntos']}
                  rows={misPartidos.map((partido) => [
                    `${partido.fecha} ${formatTime(partido.hora)}`,
                    `${partido.equipo_local_nombre} vs ${partido.equipo_visitante_nombre}`,
                    formatSets(partido),
                    partido.ganador_nombre || '-',
                    `${partido.equipo_local_nombre}: ${partido.puntos_local} / ${partido.equipo_visitante_nombre}: ${partido.puntos_visitante}`,
                  ])}
                />
              </Panel>
            )}

            {activeMenu === 'posiciones' && (
              <Panel title="Posiciones" subtitle="Tabla de posiciones del campeonato.">
                <DataTable
                  headers={['Pos', 'Equipo', 'PJ', 'PG', 'PP', 'SF', 'SC', 'PF', 'PC', 'DIF', 'PTS']}
                  rows={posicionesTorneo.map((row) => [
                    row.posicion,
                    row.equipo_nombre,
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
              <Panel title="Credenciales" subtitle="Credenciales generadas para tus jugadores.">
                <DataTable
                  headers={['Codigo', 'Tipo', 'Jugador']}
                  rows={credenciales.map((credencial) => {
                    const jugador = jugadores.find((item) => String(item.id) === String(credencial.jugador));
                    return [credencial.codigo, credencial.tipo, jugador ? `${jugador.nombre} ${jugador.apellido}` : '-'];
                  })}
                />
              </Panel>
            )}
          </section>
        </main>
      </div>
    </div>
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

function getMyPosition(posiciones, equipo) {
  if (!equipo) return '-';
  return posiciones.find((row) => String(row.equipo) === String(equipo.id))?.posicion || '-';
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : '-';
}

function formatSets(partido) {
  if (!partido.sets?.length) return '-';
  return partido.sets.map((set) => `${set.puntos_local}-${set.puntos_visitante}`).join(' / ');
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
