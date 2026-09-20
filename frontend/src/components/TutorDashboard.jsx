import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import clubLogo from '../assets/club-logo.png';
import { GERENTE_CELULAR, GERENTE_WHATSAPP } from '../config/escuela';
import '../styles/Dashboard.css';
import '../styles/Escuela.css';

export default function TutorDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [familia, setFamilia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { api.getPortalTutor().then((data) => setFamilia(data.familia || [])).catch(() => setError('No se pudo cargar la informacion familiar.')).finally(() => setLoading(false)); }, []);
  const salir = () => { logout(); navigate('/', { replace: true }); };
  if (loading) return <div className="loading">Cargando portal familiar...</div>;
  return <div className="dashboard-container escuela-dashboard"><header className="dashboard-header escuela-header"><div className="header-content"><div className="brand-lockup"><img src={clubLogo} alt="Ayacucho Club de Voleibol" className="club-logo" /><div><h1>PORTAL FAMILIAR</h1><p>{user?.first_name || user?.username}</p></div></div><div className="user-info"><a className="manager-contact" href={`https://wa.me/${GERENTE_WHATSAPP}`} target="_blank" rel="noreferrer">Gerente: {GERENTE_CELULAR}</a><button className="logout-btn" onClick={salir}>Cerrar sesion</button></div></div></header><main className="family-content">{error && <div className="error">{error}</div>}{familia.length === 0 && <section className="data-panel"><h3>Cuenta sin alumnos vinculados</h3><p>Solicita a la administracion que vincule esta cuenta con la ficha del alumno.</p></section>}{familia.map((item) => <AlumnoFamiliar key={item.alumno.id} item={item} />)}</main></div>;
}

function AlumnoFamiliar({ item }) {
  const deuda = item.mensualidades.reduce((total, m) => total + Number(m.saldo), 0);
  return <section className="family-student"><div className="family-title"><div><h2>{item.alumno.nombre_completo}</h2><p>{item.alumno.categoria_nombre}</p></div><strong className={deuda > 0 ? 'family-debt' : 'family-paid'}>{deuda > 0 ? `Saldo Bs ${deuda.toFixed(2)}` : 'Pagos al dia'}</strong></div><div className="family-grid"><article><h3>Horarios</h3>{item.grupos.length ? item.grupos.map((g) => <p key={g.id}><strong>{g.nombre}</strong><br />{g.dias} · {String(g.hora_inicio).slice(0, 5)}-{String(g.hora_fin).slice(0, 5)} · {g.lugar}</p>) : <p>Sin grupo asignado.</p>}</article><article><h3>Mensualidades</h3>{item.mensualidades.slice(0, 6).map((m) => <p key={m.id}>{periodo(m.periodo)} <strong>{m.estado}</strong> · saldo Bs {Number(m.saldo).toFixed(2)}</p>)}</article><article><h3>Evaluaciones</h3>{item.evaluaciones.slice(0, 5).map((e) => <p key={e.id}>{fecha(e.fecha)} · promedio <strong>{e.promedio}/10</strong></p>)}</article><article><h3>Documentos</h3>{item.documentos.map((d) => <p key={d.id}><a href={api.getMediaUrl(d.archivo)} target="_blank" rel="noreferrer">{d.nombre}</a>{d.fecha_vencimiento ? ` · vence ${fecha(d.fecha_vencimiento)}` : ''}</p>)}</article><article><h3>Uniformes</h3>{item.uniformes.map((u) => <p key={u.id}>{u.articulo} talla {u.talla || '-'} · {u.estado} · {u.pagado ? 'pagado' : 'pago pendiente'}</p>)}</article><article><h3>Materiales</h3>{item.materiales.map((m) => <p key={m.id}>{m.material} · {m.estado}</p>)}</article></div></section>;
}

function fecha(valor) { return new Intl.DateTimeFormat('es-BO').format(new Date(`${valor}T12:00:00`)); }
function periodo(valor) { return new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' }).format(new Date(`${valor.slice(0, 7)}-01T12:00:00`)); }
