import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import api from '../services/api';
import EscuelaOperaciones from './EscuelaOperaciones';
import EscuelaGestionAvanzada from './EscuelaGestionAvanzada';
import clubLogo from '../assets/club-logo.png';
import { GERENTE_CELULAR, GERENTE_WHATSAPP } from '../config/escuela';
import '../styles/Dashboard.css';
import '../styles/Escuela.css';

const menu = [
  { id: 'resumen', icon: 'IN', label: 'Resumen' },
  { id: 'alumnos', icon: 'AL', label: 'Alumnos' },
  { id: 'categorias', icon: 'CA', label: 'Categorias' },
  { id: 'grupos', icon: 'GH', label: 'Grupos y horarios' },
  { id: 'beneficios', icon: 'BE', label: 'Becas y descuentos' },
  { id: 'cobranza', icon: 'Bs', label: 'Mensualidades' },
  { id: 'seguimiento', icon: 'ED', label: 'Evaluaciones' },
  { id: 'salud', icon: 'FM', label: 'Ficha medica' },
  { id: 'logistica', icon: 'UL', label: 'Uniformes y material' },
  { id: 'mensajes', icon: 'WA', label: 'WhatsApp' },
  { id: 'reportes', icon: 'RP', label: 'Reportes' },
  { id: 'inscripciones', icon: 'ON', label: 'Inscripciones online' },
  { id: 'finanzas', icon: 'GF', label: 'Gastos y balance' },
  { id: 'inventario', icon: 'ST', label: 'Inventario' },
  { id: 'auditoria', icon: 'AU', label: 'Auditoria' },
];

const categoriaInicial = {
  nombre: '', edad_minima: '', edad_maxima: '', monto_mensual: '', dia_vencimiento: 10,
  descripcion: '', entrenadores: [], activa: true,
};

const alumnoInicial = {
  nombres: '', apellidos: '', documento: '', fecha_nacimiento: '', fecha_inscripcion: hoy(),
  categoria: '', entrenador: '', tutor_usuario: '', direccion: '', telefono: '', tutor_nombre: '',
  tutor_parentesco: '', tutor_telefono: '', tutor_telefono_alternativo: '', tutor_email: '',
  monto_mensual_personalizado: '', estado: 'ACTIVO', observaciones: '',
};

const plantillaInicial = {
  nombre: '', tipo: 'RECORDATORIO', activa: true,
  contenido: 'Hola {tutor}, le recordamos que la mensualidad de {alumno}, categoria {categoria}, vence el {vencimiento}. Monto pendiente: Bs {saldo}. Muchas gracias.',
};

export default function EscuelaDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const esAdmin = user?.rol === 'ADMIN';
  const [seccion, setSeccion] = useState('resumen');
  const [resumen, setResumen] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [mensualidades, setMensualidades] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [entrenadores, setEntrenadores] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [categoriaForm, setCategoriaForm] = useState(categoriaInicial);
  const [alumnoForm, setAlumnoForm] = useState(alumnoInicial);
  const [plantillaForm, setPlantillaForm] = useState(plantillaInicial);
  const [editandoCategoria, setEditandoCategoria] = useState(null);
  const [editandoAlumno, setEditandoAlumno] = useState(null);
  const [editandoPlantilla, setEditandoPlantilla] = useState(null);
  const [periodo, setPeriodo] = useState(mesActual());
  const [categoriaCobro, setCategoriaCobro] = useState('');
  const [filtroAlumno, setFiltroAlumno] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroCobro, setFiltroCobro] = useState('TODOS');
  const [pagoActivo, setPagoActivo] = useState(null);
  const [pagoForm, setPagoForm] = useState({ monto: '', fecha_pago: hoy(), metodo: 'EFECTIVO', numero_comprobante: '', observaciones: '' });
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const cargarDatos = useCallback(async () => {
    const consultas = [
      api.getResumenEscuela(), api.getCategoriasEscuela(), api.getAlumnosEscuela(),
      api.getMensualidadesEscuela(), api.getPlantillasEscuela(),
    ];
    if (esAdmin) consultas.push(api.getUsuarios());
    const [resumenData, categoriasData, alumnosData, mensualidadesData, plantillasData, usuariosData = []] = await Promise.all(consultas);
    setResumen(resumenData);
    setCategorias(categoriasData);
    setAlumnos(alumnosData);
    setMensualidades(mensualidadesData);
    setPlantillas(plantillasData);
    setEntrenadores(usuariosData.filter((item) => item.rol === 'ENTRENADOR'));
    setTutores(usuariosData.filter((item) => item.rol === 'TUTOR'));
    setPlantillaSeleccionada((actual) => actual || (plantillasData.length ? String(plantillasData[0].id) : ''));
  }, [esAdmin]);

  useEffect(() => {
    cargarDatos().catch((err) => {
      console.error(err);
      setError('No se pudo cargar la informacion de la escuela.');
    }).finally(() => setLoading(false));
  }, [cargarDatos]);

  const alumnosFiltrados = useMemo(() => alumnos.filter((alumno) => {
    const texto = `${alumno.nombres} ${alumno.apellidos} ${alumno.documento}`.toLowerCase();
    return (!filtroAlumno || texto.includes(filtroAlumno.toLowerCase()))
      && (!filtroCategoria || String(alumno.categoria) === filtroCategoria);
  }), [alumnos, filtroAlumno, filtroCategoria]);

  const cobrosFiltrados = useMemo(() => mensualidades.filter((item) => {
    const esPeriodo = item.periodo?.slice(0, 7) === periodo;
    const esCategoria = !categoriaCobro || String(item.alumno && alumnos.find((a) => a.id === item.alumno)?.categoria) === categoriaCobro;
    const esEstado = filtroCobro === 'TODOS'
      || (filtroCobro === 'VENCIDA' ? item.vencida : item.estado === filtroCobro);
    return esPeriodo && esCategoria && esEstado;
  }), [mensualidades, alumnos, periodo, categoriaCobro, filtroCobro]);

  const deudores = useMemo(() => mensualidades.filter((item) => item.estado !== 'PAGADA' && item.estado !== 'ANULADA' && Number(item.saldo) > 0), [mensualidades]);

  const ejecutar = async (accion, mensaje) => {
    setSaving(true); setError(''); setNotice('');
    try {
      await accion();
      await cargarDatos();
      setNotice(mensaje);
      return true;
    } catch (err) {
      console.error(err);
      setError(extraerError(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const guardarCategoria = (event) => {
    event.preventDefault();
    const datos = limpiarVacios(categoriaForm, ['edad_minima', 'edad_maxima']);
    ejecutar(
      () => editandoCategoria ? api.updateCategoriaEscuela(editandoCategoria, datos) : api.createCategoriaEscuela(datos),
      editandoCategoria ? 'Categoria actualizada.' : 'Categoria creada.',
    ).then((ok) => { if (ok) { setCategoriaForm(categoriaInicial); setEditandoCategoria(null); } });
  };

  const editarCategoria = (categoria) => {
    setCategoriaForm({ ...categoria, entrenadores: categoria.entrenadores || [] });
    setEditandoCategoria(categoria.id);
  };

  const guardarAlumno = (event) => {
    event.preventDefault();
    const datos = limpiarVacios(alumnoForm, ['fecha_nacimiento', 'entrenador', 'tutor_usuario', 'monto_mensual_personalizado']);
    ejecutar(
      () => editandoAlumno ? api.updateAlumnoEscuela(editandoAlumno, datos) : api.createAlumnoEscuela(datos),
      editandoAlumno ? 'Alumno actualizado.' : 'Alumno registrado.',
    ).then((ok) => { if (ok) { setAlumnoForm(alumnoInicial); setEditandoAlumno(null); } });
  };

  const editarAlumno = (alumno) => {
    setAlumnoForm({ ...alumno, entrenador: alumno.entrenador || '', tutor_usuario: alumno.tutor_usuario || '', monto_mensual_personalizado: alumno.monto_mensual_personalizado ?? '' });
    setEditandoAlumno(alumno.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generarCobros = () => ejecutar(
    () => api.generarMensualidadesEscuela({ periodo: `${periodo}-01`, ...(categoriaCobro ? { categoria: categoriaCobro } : {}) }),
    'Mensualidades generadas. Los cobros existentes no fueron duplicados.',
  );

  const registrarPago = (event) => {
    event.preventDefault();
    ejecutar(
      () => api.createPagoEscuela({ ...pagoForm, mensualidad: pagoActivo.id }),
      'Pago registrado correctamente.',
    ).then((ok) => { if (ok) { setPagoActivo(null); setPagoForm({ monto: '', fecha_pago: hoy(), metodo: 'EFECTIVO', numero_comprobante: '', observaciones: '' }); } });
  };

  const guardarPlantilla = (event) => {
    event.preventDefault();
    ejecutar(
      () => editandoPlantilla ? api.updatePlantillaEscuela(editandoPlantilla, plantillaForm) : api.createPlantillaEscuela(plantillaForm),
      editandoPlantilla ? 'Plantilla actualizada.' : 'Plantilla creada.',
    ).then((ok) => { if (ok) { setPlantillaForm(plantillaInicial); setEditandoPlantilla(null); } });
  };

  const enviarWhatsApp = async (mensualidad) => {
    const plantilla = plantillas.find((item) => String(item.id) === plantillaSeleccionada);
    const alumno = alumnos.find((item) => item.id === mensualidad.alumno);
    const contenidoBase = plantilla?.contenido || plantillaInicial.contenido;
    const contenido = completarMensaje(contenidoBase, mensualidad, alumno);
    const telefono = normalizarTelefono(mensualidad.tutor_telefono);
    if (!telefono) { setError('El tutor no tiene un telefono valido.'); return; }
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(contenido)}`, '_blank', 'noopener,noreferrer');
    try {
      await api.registrarMensajeEscuela({
        alumno: mensualidad.alumno, mensualidad: mensualidad.id, plantilla: plantilla?.id || null,
        telefono: mensualidad.tutor_telefono, contenido,
      });
      setNotice('Mensaje preparado en WhatsApp y registrado en el historial.');
    } catch (err) {
      console.error(err);
      setError('WhatsApp se abrio, pero no se pudo guardar el historial del mensaje.');
    }
  };

  const volver = () => navigate('/inicio');
  const salir = () => { logout(); navigate('/', { replace: true }); };

  if (loading) return <div className="loading">Cargando escuela...</div>;

  return (
    <div className="dashboard-container escuela-dashboard">
      <header className="dashboard-header escuela-header">
        <div className="header-content">
          <div className="brand-lockup"><img src={clubLogo} alt="Ayacucho Club de Voleibol" className="club-logo" /><div><h1>ESCUELA DE VOLEIBOL</h1><p>Gestion academica y cobranza</p></div></div>
          <div className="user-info"><a className="manager-contact" href={`https://wa.me/${GERENTE_WHATSAPP}`} target="_blank" rel="noreferrer">Gerente: {GERENTE_CELULAR}</a><button className="logout-btn" type="button" onClick={volver}>Inicio</button><button className="logout-btn" type="button" onClick={salir}>Cerrar sesion</button></div>
        </div>
      </header>
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar"><nav className="sidebar-nav">{menu.filter((item) => esAdmin || !['categorias', 'beneficios', 'inscripciones', 'finanzas', 'inventario', 'auditoria'].includes(item.id)).map((item) => <button key={item.id} className={`nav-item ${seccion === item.id ? 'active' : ''}`} onClick={() => { setSeccion(item.id); setError(''); setNotice(''); }} type="button"><span className="nav-badge">{item.icon}</span>{item.label}</button>)}</nav></aside>
        <main className="dashboard-content">
          {error && <div className="error escuela-alert">{error}</div>}
          {notice && <div className="success-message">{notice}</div>}
          {seccion === 'resumen' && <Resumen resumen={resumen} categorias={categorias} deudores={deudores} irA={setSeccion} esAdmin={esAdmin} />}
          {seccion === 'categorias' && esAdmin && <Categorias categorias={categorias} entrenadores={entrenadores} form={categoriaForm} setForm={setCategoriaForm} guardar={guardarCategoria} editar={editarCategoria} cancelar={() => { setCategoriaForm(categoriaInicial); setEditandoCategoria(null); }} editando={editandoCategoria} saving={saving} eliminar={(categoria) => confirmarEliminar(`Eliminar la categoria ${categoria.nombre}?`, () => ejecutar(() => api.deleteCategoriaEscuela(categoria.id), 'Categoria eliminada.'))} />}
          {seccion === 'alumnos' && <Alumnos alumnos={alumnosFiltrados} categorias={categorias} entrenadores={entrenadores} form={alumnoForm} setForm={setAlumnoForm} guardar={guardarAlumno} editar={editarAlumno} cancelar={() => { setAlumnoForm(alumnoInicial); setEditandoAlumno(null); }} editando={editandoAlumno} saving={saving} esAdmin={esAdmin} filtro={filtroAlumno} setFiltro={setFiltroAlumno} filtroCategoria={filtroCategoria} setFiltroCategoria={setFiltroCategoria} />}
          {seccion === 'cobranza' && <Cobranza cobros={cobrosFiltrados} categorias={categorias} periodo={periodo} setPeriodo={setPeriodo} categoria={categoriaCobro} setCategoria={setCategoriaCobro} filtro={filtroCobro} setFiltro={setFiltroCobro} generar={generarCobros} pagoActivo={pagoActivo} setPagoActivo={setPagoActivo} pagoForm={pagoForm} setPagoForm={setPagoForm} registrarPago={registrarPago} saving={saving} />}
          {seccion === 'mensajes' && <Mensajes deudores={deudores} plantillas={plantillas} seleccionada={plantillaSeleccionada} setSeleccionada={setPlantillaSeleccionada} enviar={enviarWhatsApp} esAdmin={esAdmin} form={plantillaForm} setForm={setPlantillaForm} guardar={guardarPlantilla} editando={editandoPlantilla} editar={(item) => { setPlantillaForm(item); setEditandoPlantilla(item.id); }} cancelar={() => { setPlantillaForm(plantillaInicial); setEditandoPlantilla(null); }} saving={saving} categorias={categorias} alumnos={alumnos} />}
          {seccion === 'mensajes' && <AvisosAutomaticos alumnos={alumnos} mensualidades={mensualidades} />}
          {['grupos', 'beneficios', 'seguimiento', 'salud', 'logistica', 'reportes'].includes(seccion) && <EscuelaOperaciones modulo={seccion} categorias={categorias} alumnos={alumnos} entrenadores={entrenadores} onChanged={cargarDatos} onError={setError} onNotice={setNotice} />}
          {esAdmin && ['inscripciones', 'finanzas', 'inventario', 'auditoria'].includes(seccion) && <EscuelaGestionAvanzada modulo={seccion} alumnos={alumnos} tutores={tutores} onChanged={cargarDatos} onError={setError} onNotice={setNotice} />}
        </main>
      </div>
    </div>
  );
}

function Resumen({ resumen, categorias, deudores, irA, esAdmin }) {
  const facturado = Number(resumen.total_facturado || 0);
  const cobrado = Number(resumen.total_cobrado || 0);
  const avance = facturado > 0 ? Math.min(Math.round((cobrado / facturado) * 100), 100) : 0;
  const categoriasActivas = categorias.filter((item) => item.activa);
  const mayorCategoria = Math.max(...categoriasActivas.map((item) => Number(item.total_alumnos || 0)), 1);
  const periodo = new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="school-overview">
      <section className="school-overview-heading">
        <div>
          <span className="overview-kicker">RESUMEN OPERATIVO</span>
          <h2>Administracion de la escuela</h2>
          <p>Consulta el estado de alumnos, grupos y cobranza desde un solo lugar.</p>
        </div>
        <div className="overview-period">
          <span>Periodo actual</span>
          <strong>{periodo}</strong>
        </div>
      </section>

      <section className="school-kpi-grid" aria-label="Indicadores principales">
        <Stat codigo="AL" titulo="Alumnos activos" valor={resumen.alumnos_activos || 0} detalle="Matriculados actualmente" tono="green" />
        <Stat codigo="CA" titulo="Categorias activas" valor={resumen.categorias_activas || 0} detalle="Disponibles en la escuela" tono="blue" />
        <Stat codigo="GR" titulo="Grupos activos" valor={resumen.grupos_activos || 0} detalle="Horarios habilitados" tono="violet" />
        <Stat codigo="CO" titulo="Total cobrado" valor={moneda(cobrado)} detalle={`${avance}% de lo facturado`} tono="teal" />
        <Stat codigo="PE" titulo="Saldo pendiente" valor={moneda(resumen.saldo_pendiente)} detalle={`${deudores.length} mensualidades por cobrar`} tono="amber" />
        <Stat codigo="VE" titulo="Cobros vencidos" valor={resumen.mensualidades_vencidas || 0} detalle="Requieren seguimiento" tono="red" />
      </section>

      <section className="overview-actions" aria-label="Accesos rapidos">
        <div>
          <span>Accesos rapidos</span>
          <strong>Continua con una tarea frecuente</strong>
        </div>
        <button type="button" onClick={() => irA('alumnos')}>Registrar alumno</button>
        {esAdmin && <button type="button" onClick={() => irA('categorias')}>Crear categoria</button>}
        <button type="button" onClick={() => irA('cobranza')}>Gestionar mensualidades</button>
        <button type="button" onClick={() => irA('mensajes')}>Abrir WhatsApp</button>
        <button type="button" onClick={() => irA('reportes')}>Ver reportes</button>
      </section>

      <section className="overview-content-grid">
        <article className="data-panel category-overview-panel">
          <div className="panel-header overview-panel-header">
            <div>
              <span className="panel-eyebrow">ALUMNOS</span>
              <h3>Distribucion por categoria</h3>
              <p>Cantidad de alumnos activos registrada en cada categoria.</p>
            </div>
            <strong>{resumen.alumnos_activos || 0} en total</strong>
          </div>
          {categoriasActivas.length ? (
            <div className="category-overview-list">
              {categoriasActivas.map((item) => {
                const total = Number(item.total_alumnos || 0);
                return (
                  <div className="category-overview-row" key={item.id}>
                    <div><strong>{item.nombre}</strong><span>{moneda(item.monto_mensual)} / mes</span></div>
                    <div className="category-meter"><i style={{ width: `${Math.max((total / mayorCategoria) * 100, total ? 8 : 0)}%` }} /></div>
                    <b>{total}</b>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overview-empty"><strong>Aun no existen categorias activas</strong><span>Crea la primera categoria para comenzar a registrar alumnos.</span>{esAdmin && <button type="button" onClick={() => irA('categorias')}>Crear categoria</button>}</div>
          )}
        </article>

        <article className="data-panel collection-overview-panel">
          <div className="panel-header overview-panel-header">
            <div>
              <span className="panel-eyebrow">COBRANZA</span>
              <h3>Estado financiero</h3>
              <p>Avance acumulado de las mensualidades generadas.</p>
            </div>
          </div>
          <div className="collection-progress-heading"><div><span>Cobrado</span><strong>{moneda(cobrado)}</strong></div><b>{avance}%</b></div>
          <div className="collection-progress" aria-label={`${avance}% cobrado`}><i style={{ width: `${avance}%` }} /></div>
          <div className="collection-totals"><div><span>Facturado</span><strong>{moneda(facturado)}</strong></div><div><span>Pendiente</span><strong>{moneda(resumen.saldo_pendiente)}</strong></div><div><span>Becas activas</span><strong>{resumen.becas_activas || 0}</strong></div></div>
          <div className="debt-preview">
            <div className="debt-preview-title"><strong>Seguimiento prioritario</strong><span>{deudores.length} pendientes</span></div>
            {deudores.length ? deudores.slice(0, 3).map((item) => <div className="debt-preview-row" key={item.id}><div><strong>{item.alumno_nombre}</strong><span>{item.categoria_nombre}</span></div><b>{moneda(item.saldo)}</b></div>) : <p className="debt-clear">No hay mensualidades pendientes.</p>}
          </div>
          <div className="collection-buttons"><button type="button" onClick={() => irA('cobranza')}>Ver mensualidades</button><button className="primary" type="button" onClick={() => irA('mensajes')}>Preparar recordatorios</button></div>
        </article>
      </section>
    </div>
  );
}

function Categorias({ categorias, entrenadores, form, setForm, guardar, editar, cancelar, editando, saving, eliminar }) {
  return <section className="data-panel"><div className="panel-header"><div><h3>Categorias de la escuela</h3><p>Crea Sub 8, Sub 10 o cualquier categoria y define su mensualidad.</p></div></div><form className="dashboard-form" onSubmit={guardar}><Campo label="Nombre"><input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Sub 10" /></Campo><Campo label="Edad minima"><input type="number" min="3" max="99" value={form.edad_minima ?? ''} onChange={(e) => setForm({ ...form, edad_minima: e.target.value })} /></Campo><Campo label="Edad maxima"><input type="number" min="3" max="99" value={form.edad_maxima ?? ''} onChange={(e) => setForm({ ...form, edad_maxima: e.target.value })} /></Campo><Campo label="Mensualidad (Bs)"><input required type="number" min="0" step="0.01" value={form.monto_mensual} onChange={(e) => setForm({ ...form, monto_mensual: e.target.value })} /></Campo><Campo label="Dia de vencimiento"><input required type="number" min="1" max="28" value={form.dia_vencimiento} onChange={(e) => setForm({ ...form, dia_vencimiento: e.target.value })} /></Campo><Campo label="Entrenadores"><select multiple value={form.entrenadores || []} onChange={(e) => setForm({ ...form, entrenadores: [...e.target.selectedOptions].map((option) => option.value) })}>{entrenadores.map((item) => <option key={item.id} value={item.id}>{nombreUsuario(item)}</option>)}</select></Campo><textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripcion u horarios de referencia" /><button className="action-btn primary" disabled={saving}>{editando ? 'Guardar cambios' : 'Crear categoria'}</button>{editando && <button className="action-btn" type="button" onClick={cancelar}>Cancelar</button>}</form><Tabla headers={['Categoria', 'Edades', 'Mensualidad', 'Vence', 'Entrenadores', 'Estado', 'Acciones']} rows={categorias.map((item) => [item.nombre, rangoEdad(item), moneda(item.monto_mensual), `Dia ${item.dia_vencimiento}`, item.entrenadores_detalle?.map((e) => e.nombre_completo).join(', ') || 'Sin asignar', item.activa ? 'Activa' : 'Inactiva', <Acciones key={item.id}><button onClick={() => editar(item)}>Editar</button><button className="danger-link" onClick={() => eliminar(item)}>Eliminar</button></Acciones>])} /></section>;
}

function Alumnos({ alumnos, categorias, entrenadores, form, setForm, guardar, editar, cancelar, editando, saving, esAdmin, filtro, setFiltro, filtroCategoria, setFiltroCategoria }) {
  return <section className="data-panel"><div className="panel-header"><div><h3>Alumnos</h3><p>Ficha del alumno, responsable de pago y categoria.</p></div></div><form className="dashboard-form escuela-form" onSubmit={guardar}><Campo label="Nombres"><input required value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} /></Campo><Campo label="Apellidos"><input required value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} /></Campo><Campo label="Documento"><input required value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></Campo><Campo label="Fecha de nacimiento"><input type="date" value={form.fecha_nacimiento || ''} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} /></Campo><Campo label="Categoria"><select required value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}><option value="">Seleccionar</option>{categorias.filter((c) => c.activa).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>{esAdmin && <Campo label="Entrenador"><select value={form.entrenador || ''} onChange={(e) => setForm({ ...form, entrenador: e.target.value })}><option value="">Sin asignar</option>{entrenadores.map((e) => <option key={e.id} value={e.id}>{nombreUsuario(e)}</option>)}</select></Campo>}<Campo label="Fecha de inscripcion"><input required type="date" value={form.fecha_inscripcion} onChange={(e) => setForm({ ...form, fecha_inscripcion: e.target.value })} /></Campo><Campo label="Telefono del alumno"><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Campo><Campo label="Tutor o responsable"><input required value={form.tutor_nombre} onChange={(e) => setForm({ ...form, tutor_nombre: e.target.value })} /></Campo><Campo label="Parentesco"><input value={form.tutor_parentesco} onChange={(e) => setForm({ ...form, tutor_parentesco: e.target.value })} /></Campo><Campo label="WhatsApp del tutor"><input required value={form.tutor_telefono} onChange={(e) => setForm({ ...form, tutor_telefono: e.target.value })} placeholder="Ej. 71234567" /></Campo><Campo label="Telefono alternativo"><input value={form.tutor_telefono_alternativo} onChange={(e) => setForm({ ...form, tutor_telefono_alternativo: e.target.value })} /></Campo><Campo label="Correo del tutor"><input type="email" value={form.tutor_email} onChange={(e) => setForm({ ...form, tutor_email: e.target.value })} /></Campo><Campo label="Mensualidad especial"><input type="number" min="0" step="0.01" value={form.monto_mensual_personalizado ?? ''} onChange={(e) => setForm({ ...form, monto_mensual_personalizado: e.target.value })} placeholder="Usa la de la categoria" /></Campo><Campo label="Estado"><select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option><option value="RETIRADO">Retirado</option></select></Campo><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Direccion" /><textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Alergias, informacion medica u observaciones" /><button className="action-btn primary" disabled={saving}>{editando ? 'Guardar cambios' : 'Registrar alumno'}</button>{editando && <button className="action-btn" type="button" onClick={cancelar}>Cancelar</button>}</form><div className="filters-row"><input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar alumno o documento" /><select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}><option value="">Todas las categorias</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div><Tabla headers={['Alumno', 'Documento', 'Categoria', 'Tutor', 'WhatsApp', 'Mensualidad', 'Estado', 'Acciones']} rows={alumnos.map((item) => [`${item.nombres} ${item.apellidos}`, item.documento, item.categoria_nombre, item.tutor_nombre, item.tutor_telefono, moneda(item.monto_mensual), item.estado, <Acciones key={item.id}><button onClick={() => editar(item)}>Editar</button></Acciones>])} /></section>;
}

function Cobranza({ cobros, categorias, periodo, setPeriodo, categoria, setCategoria, filtro, setFiltro, generar, pagoActivo, setPagoActivo, pagoForm, setPagoForm, registrarPago, saving }) {
  const descargarEstadoCuenta = async (mensualidad) => {
    const todas = await api.getMensualidadesEscuela();
    descargarEstadoCuentaCompleta(mensualidad, todas.filter((item) => item.alumno === mensualidad.alumno));
  };
  return <section className="data-panel"><div className="panel-header"><div><h3>Mensualidades y pagos</h3><p>Genera cargos con becas o descuentos, registra abonos y emite recibos.</p></div></div><div className="collection-toolbar"><Campo label="Periodo"><input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} /></Campo><Campo label="Categoria"><select value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">Todas</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo><Campo label="Estado"><select value={filtro} onChange={(e) => setFiltro(e.target.value)}><option value="TODOS">Todos</option><option value="PENDIENTE">Pendientes</option><option value="PARCIAL">Pago parcial</option><option value="PAGADA">Pagadas</option><option value="VENCIDA">Vencidas</option></select></Campo><button className="action-btn primary" type="button" disabled={saving} onClick={generar}>Generar mensualidades</button></div>{pagoActivo && <form className="payment-form" onSubmit={registrarPago}><div><strong>Registrar pago</strong><span>{pagoActivo.alumno_nombre} · saldo {moneda(pagoActivo.saldo)}</span></div><input required type="number" min="0.01" max={pagoActivo.saldo} step="0.01" value={pagoForm.monto} onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })} placeholder="Monto" /><input required type="date" value={pagoForm.fecha_pago} onChange={(e) => setPagoForm({ ...pagoForm, fecha_pago: e.target.value })} /><select value={pagoForm.metodo} onChange={(e) => setPagoForm({ ...pagoForm, metodo: e.target.value })}><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="QR">QR</option><option value="OTRO">Otro</option></select><input value={pagoForm.numero_comprobante} onChange={(e) => setPagoForm({ ...pagoForm, numero_comprobante: e.target.value })} placeholder="Nro. comprobante" /><button className="action-btn primary" disabled={saving}>Confirmar pago</button><button className="action-btn" type="button" onClick={() => setPagoActivo(null)}>Cancelar</button></form>}<Tabla headers={['Alumno', 'Categoria', 'Base', 'Descuento', 'Cargo', 'Pagado', 'Saldo', 'Estado', 'Acciones']} rows={cobros.map((item) => [item.alumno_nombre, item.categoria_nombre, moneda(item.monto_base || item.monto), moneda(item.descuento_aplicado), moneda(item.monto), moneda(item.total_pagado), moneda(item.saldo), <EstadoCobro key={`e-${item.id}`} item={item} />, <Acciones key={item.id}>{item.estado !== 'PAGADA' && item.estado !== 'ANULADA' && <button onClick={() => { setPagoActivo(item); setPagoForm((actual) => ({ ...actual, monto: item.saldo })); }}>Registrar pago</button>}{item.pagos?.length > 0 && <button onClick={() => descargarRecibo(item.pagos[0], item)}>Recibo</button>}<button onClick={() => descargarEstadoCuenta(item)}>Estado</button></Acciones>])} /></section>;
}

function Mensajes({ deudores, plantillas, seleccionada, setSeleccionada, enviar, esAdmin, form, setForm, guardar, editando, editar, cancelar, saving, categorias, alumnos }) {
  const [categoriaGeneral, setCategoriaGeneral] = useState('');
  const [mensajeGeneral, setMensajeGeneral] = useState('Hola {tutor}, tenemos un aviso para {alumno} de la categoria {categoria}: ');
  const destinatarios = alumnos.filter((alumno) => alumno.estado === 'ACTIVO' && (!categoriaGeneral || String(alumno.categoria) === categoriaGeneral));
  const abrirGeneral = (alumno) => { const texto = mensajeGeneral.replaceAll('{tutor}', alumno.tutor_nombre).replaceAll('{alumno}', `${alumno.nombres} ${alumno.apellidos}`).replaceAll('{categoria}', alumno.categoria_nombre); const telefono = normalizarTelefono(alumno.tutor_telefono); if (telefono) window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer'); };
  return <div className="escuela-stack">{esAdmin && <section className="data-panel"><div className="panel-header"><div><h3>Plantillas de mensajes</h3><p>Usa variables para personalizar cada recordatorio automaticamente.</p></div></div><form className="dashboard-form" onSubmit={guardar}><Campo label="Nombre"><input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Campo><Campo label="Tipo"><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="RECORDATORIO">Recordatorio</option><option value="DEUDA">Aviso de deuda</option><option value="CONFIRMACION">Confirmacion</option><option value="GENERAL">General</option></select></Campo><textarea required value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} /><p className="template-help">Variables: {'{alumno} {tutor} {categoria} {periodo} {monto} {saldo} {vencimiento}'}</p><button className="action-btn primary" disabled={saving}>{editando ? 'Guardar plantilla' : 'Crear plantilla'}</button>{editando && <button className="action-btn" type="button" onClick={cancelar}>Cancelar</button>}</form><div className="template-list">{plantillas.map((item) => <button key={item.id} type="button" onClick={() => editar(item)}><strong>{item.nombre}</strong><span>{item.tipo}</span></button>)}</div></section>}<section className="data-panel"><div className="panel-header"><div><h3>Avisos por categoria</h3><p>Prepara el mismo aviso para cada tutor, conservando el nombre del alumno.</p></div></div><div className="dashboard-form"><Campo label="Categoria"><select value={categoriaGeneral} onChange={(e) => setCategoriaGeneral(e.target.value)}><option value="">Todas</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo><textarea value={mensajeGeneral} onChange={(e) => setMensajeGeneral(e.target.value)} /></div><Tabla headers={['Alumno', 'Tutor', 'WhatsApp', 'Accion']} rows={destinatarios.map((a) => [`${a.nombres} ${a.apellidos}`, a.tutor_nombre, a.tutor_telefono, <Acciones key={a.id}><button className="whatsapp-btn" onClick={() => abrirGeneral(a)}>Preparar</button></Acciones>])} /></section><section className="data-panel"><div className="panel-header"><div><h3>Recordatorios de pago</h3><p>El mensaje se prepara con la deuda exacta, sin recargos.</p></div></div><div className="filters-row"><select value={seleccionada} onChange={(e) => setSeleccionada(e.target.value)}><option value="">Mensaje predeterminado</option>{plantillas.filter((p) => p.activa).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div><Tabla headers={['Alumno', 'Tutor', 'Telefono', 'Periodo', 'Vencimiento', 'Saldo', 'Accion']} rows={deudores.map((item) => [item.alumno_nombre, item.tutor_nombre, item.tutor_telefono, periodoBonito(item.periodo), fechaBonita(item.fecha_vencimiento), moneda(item.saldo), <Acciones key={item.id}><button className="whatsapp-btn" onClick={() => enviar(item)}>Abrir WhatsApp</button></Acciones>])} /></section></div>;
}

function AvisosAutomaticos({ alumnos, mensualidades }) {
  const hoyLocal = new Date(`${hoy()}T12:00:00`);
  const limitePago = new Date(hoyLocal); limitePago.setDate(limitePago.getDate() + 7);
  const limiteCumple = new Date(hoyLocal); limiteCumple.setDate(limiteCumple.getDate() + 30);
  const porVencer = mensualidades.filter((item) => item.estado !== 'PAGADA' && item.estado !== 'ANULADA' && new Date(`${item.fecha_vencimiento}T12:00:00`) >= hoyLocal && new Date(`${item.fecha_vencimiento}T12:00:00`) <= limitePago);
  const cumpleanos = alumnos.map((alumno) => ({ alumno, fecha: proximoCumpleanos(alumno.fecha_nacimiento, hoyLocal) })).filter((item) => item.fecha && item.fecha <= limiteCumple).sort((a, b) => a.fecha - b.fecha);
  const enviarCumple = ({ alumno }) => { const telefono = normalizarTelefono(alumno.tutor_telefono); const texto = `Hola ${alumno.tutor_nombre}, saludamos a ${alumno.nombres} por su proximo cumpleanos. Reciba un afectuoso saludo de la Escuela de Voleibol.`; if (telefono) window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer'); };
  return <section className="data-panel automatic-alerts"><div className="panel-header"><div><h3>Avisos detectados automaticamente</h3><p>El sistema identifica vencimientos cercanos y cumpleaños; el envio siempre requiere tu confirmacion.</p></div></div><div className="escuela-grid"><div><h4>Vencen en los proximos 7 dias</h4><Tabla headers={['Alumno', 'Vencimiento', 'Saldo']} rows={porVencer.map((item) => [item.alumno_nombre, fechaBonita(item.fecha_vencimiento), moneda(item.saldo)])} /></div><div><h4>Cumpleaños en los proximos 30 dias</h4><Tabla headers={['Alumno', 'Fecha', 'Accion']} rows={cumpleanos.map((item) => [`${item.alumno.nombres} ${item.alumno.apellidos}`, fechaBonita(item.fecha.toISOString().slice(0, 10)), <Acciones key={item.alumno.id}><button className="whatsapp-btn" onClick={() => enviarCumple(item)}>WhatsApp</button></Acciones>])} /></div></div></section>;
}

function Campo({ label, children }) { return <label className="form-field"><span className="field-label">{label}</span>{children}</label>; }
function Stat({ codigo, titulo, valor, detalle, tono }) { return <article className={`school-kpi tone-${tono}`}><div className="school-kpi-top"><span>{codigo}</span><h3>{titulo}</h3></div><strong className="school-kpi-value">{valor}</strong><p>{detalle}</p></article>; }
function Acciones({ children }) { return <div className="table-actions">{children}</div>; }
function Tabla({ headers, rows }) { return <div className="table-wrap"><table className="dashboard-table"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="empty-cell">No hay registros.</td></tr>}</tbody></table></div>; }
function EstadoCobro({ item }) { const texto = item.vencida ? 'VENCIDA' : item.estado; return <span className={`status-pill ${texto.toLowerCase()}`}>{texto}</span>; }
function hoy() { return new Date().toISOString().slice(0, 10); }
function mesActual() { return new Date().toISOString().slice(0, 7); }
function moneda(valor) { return `Bs ${Number(valor || 0).toFixed(2)}`; }
function fechaBonita(valor) { return valor ? new Intl.DateTimeFormat('es-BO').format(new Date(`${valor}T12:00:00`)) : '-'; }
function periodoBonito(valor) { return valor ? new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' }).format(new Date(`${valor.slice(0, 7)}-01T12:00:00`)) : '-'; }
function rangoEdad(item) { return item.edad_minima != null && item.edad_maxima != null ? `${item.edad_minima} a ${item.edad_maxima} anos` : 'Sin limite'; }
function nombreUsuario(item) { return `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username; }
function limpiarVacios(datos, camposNulos) { const copia = { ...datos }; camposNulos.forEach((campo) => { if (copia[campo] === '') copia[campo] = null; }); return copia; }
function confirmarEliminar(mensaje, accion) { if (window.confirm(mensaje)) accion(); }
function extraerError(error) { try { const data = JSON.parse(error.message); const primero = Object.values(data)[0]; return Array.isArray(primero) ? primero[0] : String(primero || 'No se pudo guardar.'); } catch { return 'No se pudo completar la operacion. Revisa los datos.'; } }
function normalizarTelefono(valor) { const numero = String(valor || '').replace(/\D/g, ''); if (numero.length === 8) return `591${numero}`; return numero; }
function completarMensaje(texto, mensualidad, alumno) {
  const datos = { alumno: mensualidad.alumno_nombre, tutor: mensualidad.tutor_nombre, categoria: mensualidad.categoria_nombre, periodo: periodoBonito(mensualidad.periodo), monto: Number(mensualidad.monto).toFixed(2), saldo: Number(mensualidad.saldo).toFixed(2), vencimiento: fechaBonita(mensualidad.fecha_vencimiento) };
  return Object.entries(datos).reduce((resultado, [clave, valor]) => resultado.replaceAll(`{${clave}}`, valor), texto).replace('{telefono}', alumno?.tutor_telefono || '');
}
function proximoCumpleanos(fechaNacimiento, referencia) { if (!fechaNacimiento) return null; const partes = fechaNacimiento.split('-').map(Number); let fecha = new Date(referencia.getFullYear(), partes[1] - 1, partes[2], 12); if (fecha < referencia) fecha = new Date(referencia.getFullYear() + 1, partes[1] - 1, partes[2], 12); return fecha; }

async function descargarRecibo(pago, mensualidad) {
  const doc = new jsPDF();
  try { doc.addImage(await cargarImagenDataUrl(clubLogo), 'PNG', 168, 10, 22, 22); } catch { /* El recibo sigue disponible sin imagen. */ }
  doc.setFontSize(18); doc.text('ESCUELA DE VOLEIBOL', 20, 22);
  doc.setFontSize(13); doc.text(`RECIBO ${pago.numero_recibo || pago.id}`, 20, 34);
  doc.setFontSize(11); doc.text(`Alumno: ${mensualidad.alumno_nombre}`, 20, 50); doc.text(`Categoria: ${mensualidad.categoria_nombre}`, 20, 58); doc.text(`Periodo: ${periodoBonito(mensualidad.periodo)}`, 20, 66); doc.text(`Fecha de pago: ${fechaBonita(pago.fecha_pago)}`, 20, 74); doc.text(`Metodo: ${pago.metodo}`, 20, 82); doc.setFontSize(16); doc.text(`IMPORTE: ${moneda(pago.monto)}`, 20, 98); doc.setFontSize(9); doc.text(`Contacto del gerente: ${GERENTE_CELULAR}`, 20, 112); doc.text('Comprobante generado por el sistema de la Escuela de Voleibol.', 20, 120);
  const nombre = `recibo-${pago.numero_recibo || pago.id}.pdf`;
  const archivo = new File([doc.output('blob')], nombre, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [archivo] }) && window.confirm('Deseas compartir este recibo por WhatsApp u otra aplicacion?')) {
    await navigator.share({ title: `Recibo ${pago.numero_recibo || pago.id}`, text: `Comprobante de pago de ${mensualidad.alumno_nombre}`, files: [archivo] });
  } else {
    doc.save(nombre);
  }
}

function descargarEstadoCuentaCompleta(mensualidad, cuenta) {
  const doc = new jsPDF();
  const totalCargos = cuenta.reduce((total, item) => total + Number(item.monto), 0);
  const totalPagado = cuenta.reduce((total, item) => total + Number(item.total_pagado), 0);
  const saldo = cuenta.reduce((total, item) => total + Number(item.saldo), 0);
  doc.setFontSize(18); doc.text('ESTADO DE CUENTA', 20, 22);
  doc.setFontSize(11); doc.text(`Alumno: ${mensualidad.alumno_nombre}`, 20, 38); doc.text(`Categoria: ${mensualidad.categoria_nombre}`, 20, 46); doc.text(`Contacto del gerente: ${GERENTE_CELULAR}`, 120, 46);
  doc.text(`Total cargos: ${moneda(totalCargos)}`, 20, 58); doc.text(`Total pagado: ${moneda(totalPagado)}`, 20, 66); doc.setFontSize(15); doc.text(`SALDO TOTAL: ${moneda(saldo)}`, 20, 78);
  let y = 94; doc.setFontSize(9); doc.text('Periodo', 20, y); doc.text('Cargo', 70, y); doc.text('Pagado', 105, y); doc.text('Saldo', 145, y); doc.text('Estado', 175, y); y += 7;
  cuenta.sort((a, b) => a.periodo.localeCompare(b.periodo)).forEach((item) => { if (y > 280) { doc.addPage(); y = 20; } doc.text(periodoBonito(item.periodo), 20, y); doc.text(moneda(item.monto), 70, y); doc.text(moneda(item.total_pagado), 105, y); doc.text(moneda(item.saldo), 145, y); doc.text(item.estado, 175, y); y += 7; });
  doc.save(`estado-${mensualidad.alumno_nombre.replaceAll(' ', '-')}.pdf`);
}

async function cargarImagenDataUrl(origen) { const respuesta = await fetch(origen); const blob = await respuesta.blob(); return new Promise((resolve, reject) => { const lector = new FileReader(); lector.onload = () => resolve(lector.result); lector.onerror = reject; lector.readAsDataURL(blob); }); }
