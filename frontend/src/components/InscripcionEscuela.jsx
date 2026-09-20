import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import clubLogo from '../assets/club-logo.png';
import { GERENTE_CELULAR, GERENTE_WHATSAPP } from '../config/escuela';
import '../styles/EscuelaPublica.css';

const inicial = { categoria: '', grupo: '', alumno_nombres: '', alumno_apellidos: '', documento: '', fecha_nacimiento: '', tutor_nombre: '', tutor_telefono: '', tutor_email: '', observaciones: '' };

export default function InscripcionEscuela() {
  const [catalogo, setCatalogo] = useState({ categorias: [], grupos: [] });
  const [form, setForm] = useState(inicial);
  const [estado, setEstado] = useState('cargando');
  const [mensaje, setMensaje] = useState('');
  const grupos = useMemo(() => catalogo.grupos.filter((g) => !form.categoria || String(g.categoria) === form.categoria), [catalogo.grupos, form.categoria]);

  useEffect(() => { api.getCatalogoInscripcion().then((data) => { setCatalogo(data); setEstado('listo'); }).catch(() => { setMensaje('No se pudo cargar la informacion de inscripcion.'); setEstado('error'); }); }, []);

  const enviar = async (event) => {
    event.preventDefault(); setEstado('guardando'); setMensaje('');
    try {
      await api.createSolicitudInscripcion({ ...form, grupo: form.grupo || null, fecha_nacimiento: form.fecha_nacimiento || null });
      setForm(inicial); setEstado('enviada'); setMensaje('Solicitud recibida. La Escuela se comunicara con el tutor para confirmar el cupo.');
    } catch (error) {
      setEstado('listo'); setMensaje(leerError(error));
    }
  };

  return <main className="public-school-page"><header><div className="public-brand"><img src={clubLogo} alt="Ayacucho Club de Voleibol" /><div><h1>Inscripcion a la Escuela</h1><p>Ayacucho Club de Voleibol</p></div></div><Link to="/">Ingresar al sistema</Link></header><section className="public-form-wrap"><div className="public-form-heading"><h2>Solicitud de inscripcion</h2><p>Completa los datos del alumno y del responsable. La solicitud queda pendiente hasta que la administracion confirme el cupo.</p></div>{mensaje && <div className={estado === 'enviada' ? 'public-success' : 'public-error'}>{mensaje}</div>}{estado !== 'cargando' && <form onSubmit={enviar}><label>Categoria<select required value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value, grupo: '' })}><option value="">Seleccionar categoria</option>{catalogo.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre} - Bs {c.monto_mensual}/mes</option>)}</select></label><label>Grupo preferido<select value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.target.value })}><option value="">Sin preferencia</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre} · {g.dias} · {String(g.hora_inicio).slice(0, 5)} · {g.cupos_disponibles} cupos</option>)}</select></label><label>Nombres del alumno<input required value={form.alumno_nombres} onChange={(e) => setForm({ ...form, alumno_nombres: e.target.value })} /></label><label>Apellidos del alumno<input required value={form.alumno_apellidos} onChange={(e) => setForm({ ...form, alumno_apellidos: e.target.value })} /></label><label>Documento<input required value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></label><label>Fecha de nacimiento<input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} /></label><label>Nombre del tutor<input required value={form.tutor_nombre} onChange={(e) => setForm({ ...form, tutor_nombre: e.target.value })} /></label><label>WhatsApp del tutor<input required type="tel" value={form.tutor_telefono} onChange={(e) => setForm({ ...form, tutor_telefono: e.target.value })} /></label><label>Correo del tutor<input type="email" value={form.tutor_email} onChange={(e) => setForm({ ...form, tutor_email: e.target.value })} /></label><label className="wide">Observaciones<textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></label><button disabled={estado === 'guardando'}>{estado === 'guardando' ? 'Enviando...' : 'Enviar solicitud'}</button></form>}<footer>Consultas: <a href={`https://wa.me/${GERENTE_WHATSAPP}`} target="_blank" rel="noreferrer">Gerente {GERENTE_CELULAR}</a></footer></section></main>;
}

function leerError(error) { try { const data = JSON.parse(error.message); const valor = Object.values(data)[0]; return Array.isArray(valor) ? valor[0] : String(valor); } catch { return 'No se pudo enviar la solicitud. Revisa los datos.'; } }
