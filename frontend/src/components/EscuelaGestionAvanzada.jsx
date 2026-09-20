import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const gastoInicial = { concepto: '', categoria: 'CANCHA', monto: '', fecha: hoy(), metodo: 'EFECTIVO', observaciones: '' };
const productoInicial = { nombre: '', tipo: 'UNIFORME', talla: '', stock: 0, stock_minimo: 2, costo_unitario: 0, precio_venta: 0, activo: true };
const movimientoInicial = { producto: '', tipo: 'ENTRADA', cantidad: 1, motivo: '', alumno: '' };

export default function EscuelaGestionAvanzada({ modulo, alumnos, tutores, onChanged, onError, onNotice }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [espera, setEspera] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [reporte, setReporte] = useState({ categorias: [] });
  const [gastoForm, setGastoForm] = useState(gastoInicial);
  const [productoForm, setProductoForm] = useState(productoInicial);
  const [movimientoForm, setMovimientoForm] = useState(movimientoInicial);
  const [vinculo, setVinculo] = useState({ alumno: '', tutor: '' });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [s, e, g, p, m, a, d, r] = await Promise.all([
        api.getSolicitudesInscripcion(), api.listaEsperaEscuela.list(), api.gastosEscuela.list(),
        api.inventarioEscuela.list(), api.getMovimientosInventario(), api.getAuditoriaEscuela(),
        api.getDocumentosEscuela(), api.getReportesEscuela(),
      ]);
      setSolicitudes(s); setEspera(e); setGastos(g); setProductos(p); setMovimientos(m); setAuditoria(a); setDocumentos(d); setReporte(r);
    } catch (error) { console.error(error); onError('No se pudo cargar la administracion avanzada.'); }
  }, [onError]);
  useEffect(() => { cargar(); }, [cargar]);

  const ejecutar = async (accion, mensaje) => {
    setSaving(true); onError('');
    try { await accion(); await Promise.all([cargar(), onChanged()]); onNotice(mensaje); return true; }
    catch (error) { console.error(error); onError(errorLegible(error)); return false; }
    finally { setSaving(false); }
  };

  if (modulo === 'inscripciones') return <Inscripciones solicitudes={solicitudes} espera={espera} alumnos={alumnos} tutores={tutores} vinculo={vinculo} setVinculo={setVinculo} documentos={documentos} revisar={(id, estado) => ejecutar(() => api.revisarSolicitudInscripcion(id, { estado }), 'Solicitud actualizada.')} actualizarEspera={(id, estado) => ejecutar(() => api.listaEsperaEscuela.update(id, { estado }), 'Lista de espera actualizada.')} vincular={() => ejecutar(() => api.updateAlumnoEscuela(vinculo.alumno, { tutor_usuario: vinculo.tutor || null }), 'Cuenta familiar vinculada.')} />;
  if (modulo === 'finanzas') return <Finanzas gastos={gastos} reporte={reporte} form={gastoForm} setForm={setGastoForm} saving={saving} guardar={async (e) => { e.preventDefault(); const ok = await ejecutar(() => api.gastosEscuela.create(gastoForm), 'Gasto registrado.'); if (ok) setGastoForm(gastoInicial); }} />;
  if (modulo === 'inventario') return <Inventario productos={productos} movimientos={movimientos} alumnos={alumnos} productoForm={productoForm} setProductoForm={setProductoForm} movimientoForm={movimientoForm} setMovimientoForm={setMovimientoForm} saving={saving} guardarProducto={async (e) => { e.preventDefault(); const ok = await ejecutar(() => api.inventarioEscuela.create(productoForm), 'Producto creado.'); if (ok) setProductoForm(productoInicial); }} guardarMovimiento={async (e) => { e.preventDefault(); const datos = { ...movimientoForm, alumno: movimientoForm.alumno || null }; const ok = await ejecutar(() => api.createMovimientoInventario(datos), 'Movimiento registrado.'); if (ok) setMovimientoForm(movimientoInicial); }} />;
  if (modulo === 'auditoria') return <Auditoria registros={auditoria} />;
  return null;
}

function Inscripciones({ solicitudes, espera, alumnos, tutores, vinculo, setVinculo, documentos, revisar, actualizarEspera, vincular }) {
  const limite = new Date(); limite.setDate(limite.getDate() + 30);
  const porVencer = documentos.filter((d) => d.fecha_vencimiento && new Date(`${d.fecha_vencimiento}T12:00:00`) <= limite);
  return <div className="escuela-stack"><Panel titulo="Solicitudes de inscripcion" subtitulo="Aprueba solicitudes con cupo disponible; los grupos llenos pasan a lista de espera."><Tabla headers={['Fecha', 'Alumno', 'Categoria', 'Grupo', 'Tutor', 'Estado', 'Acciones']} rows={solicitudes.map((s) => [fechaHora(s.fecha_solicitud), `${s.alumno_nombres} ${s.alumno_apellidos}`, s.categoria_nombre, s.grupo_nombre || 'Sin preferencia', `${s.tutor_nombre} · ${s.tutor_telefono}`, s.estado, <Botones key={s.id}>{s.estado === 'PENDIENTE' && <><button onClick={() => revisar(s.id, 'APROBADA')}>Aprobar</button><button className="danger-link" onClick={() => revisar(s.id, 'RECHAZADA')}>Rechazar</button></>}</Botones>])} /></Panel><Panel titulo="Lista de espera"><Tabla headers={['Prioridad', 'Alumno', 'Categoria', 'Grupo', 'Tutor', 'Estado', 'Accion']} rows={espera.map((r) => [r.prioridad, r.alumno_nombre, r.categoria_nombre, r.grupo_nombre || '-', `${r.tutor_nombre} · ${r.tutor_telefono}`, r.estado, <Botones key={r.id}>{r.estado === 'ESPERANDO' && <button onClick={() => actualizarEspera(r.id, 'CONTACTADO')}>Marcar contactado</button>}{r.estado === 'CONTACTADO' && <button onClick={() => actualizarEspera(r.id, 'INSCRITO')}>Marcar inscrito</button>}</Botones>])} /></Panel><Panel titulo="Vincular portal familiar" subtitulo="Relaciona un alumno existente con una cuenta de tipo Tutor."><div className="dashboard-form"><Campo label="Alumno"><select value={vinculo.alumno} onChange={(e) => setVinculo({ ...vinculo, alumno: e.target.value })}><option value="">Seleccionar</option>{alumnos.map((a) => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}</select></Campo><Campo label="Cuenta del tutor"><select value={vinculo.tutor} onChange={(e) => setVinculo({ ...vinculo, tutor: e.target.value })}><option value="">Seleccionar</option>{tutores.map((t) => <option key={t.id} value={t.id}>{nombreUsuario(t)} · {t.telefono}</option>)}</select></Campo><button className="action-btn primary" type="button" disabled={!vinculo.alumno || !vinculo.tutor} onClick={vincular}>Vincular cuenta</button></div></Panel><Panel titulo="Documentos proximos a vencer"><Tabla headers={['Alumno', 'Documento', 'Vencimiento']} rows={porVencer.map((d) => [d.alumno_nombre, d.nombre, fecha(d.fecha_vencimiento)])} /></Panel></div>;
}

function Finanzas({ gastos, reporte, form, setForm, guardar, saving }) {
  const ingresos = (reporte.categorias || []).reduce((t, r) => t + Number(r.cobrado), 0);
  const egresos = gastos.reduce((t, g) => t + Number(g.monto), 0);
  return <div className="escuela-stack"><section className="stats-section"><Stat titulo="Ingresos" valor={moneda(ingresos)} /><Stat titulo="Gastos" valor={moneda(egresos)} /><Stat titulo="Resultado" valor={moneda(ingresos - egresos)} /></section><Panel titulo="Control de gastos" subtitulo="Registra alquileres, materiales, uniformes, servicios y pagos a entrenadores."><form className="dashboard-form" onSubmit={guardar}><Campo label="Concepto"><input required value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} /></Campo><Campo label="Categoria"><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}><option value="CANCHA">Cancha</option><option value="ENTRENADORES">Entrenadores</option><option value="MATERIAL">Material</option><option value="UNIFORMES">Uniformes</option><option value="SERVICIOS">Servicios</option><option value="OTRO">Otro</option></select></Campo><Campo label="Monto"><input required type="number" min="0.01" step="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></Campo><Campo label="Fecha"><input required type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Campo><Campo label="Metodo"><select value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="QR">QR</option><option value="OTRO">Otro</option></select></Campo><textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Observaciones" /><button className="action-btn primary" disabled={saving}>Registrar gasto</button></form><Tabla headers={['Fecha', 'Concepto', 'Categoria', 'Metodo', 'Monto', 'Registrado por']} rows={gastos.map((g) => [fecha(g.fecha), g.concepto, g.categoria, g.metodo, moneda(g.monto), g.registrado_por_nombre])} /></Panel></div>;
}

function Inventario({ productos, movimientos, alumnos, productoForm, setProductoForm, movimientoForm, setMovimientoForm, guardarProducto, guardarMovimiento, saving }) {
  return <div className="escuela-stack"><Panel titulo="Productos e inventario" subtitulo="Control de uniformes, balones, implementos, costos y stock minimo."><form className="dashboard-form" onSubmit={guardarProducto}><Campo label="Producto"><input required value={productoForm.nombre} onChange={(e) => setProductoForm({ ...productoForm, nombre: e.target.value })} /></Campo><Campo label="Tipo"><select value={productoForm.tipo} onChange={(e) => setProductoForm({ ...productoForm, tipo: e.target.value })}><option value="UNIFORME">Uniforme</option><option value="MATERIAL">Material</option><option value="OTRO">Otro</option></select></Campo><Campo label="Talla"><input value={productoForm.talla} onChange={(e) => setProductoForm({ ...productoForm, talla: e.target.value })} /></Campo><Campo label="Stock inicial"><input type="number" min="0" value={productoForm.stock} onChange={(e) => setProductoForm({ ...productoForm, stock: e.target.value })} /></Campo><Campo label="Stock minimo"><input type="number" min="0" value={productoForm.stock_minimo} onChange={(e) => setProductoForm({ ...productoForm, stock_minimo: e.target.value })} /></Campo><Campo label="Costo unitario"><input type="number" min="0" step="0.01" value={productoForm.costo_unitario} onChange={(e) => setProductoForm({ ...productoForm, costo_unitario: e.target.value })} /></Campo><Campo label="Precio de venta"><input type="number" min="0" step="0.01" value={productoForm.precio_venta} onChange={(e) => setProductoForm({ ...productoForm, precio_venta: e.target.value })} /></Campo><button className="action-btn primary" disabled={saving}>Crear producto</button></form><Tabla headers={['Producto', 'Tipo', 'Talla', 'Stock', 'Minimo', 'Costo', 'Venta', 'Alerta']} rows={productos.map((p) => [p.nombre, p.tipo, p.talla || '-', p.stock, p.stock_minimo, moneda(p.costo_unitario), moneda(p.precio_venta), p.bajo_stock ? 'STOCK BAJO' : 'Normal'])} /></Panel><Panel titulo="Movimientos de inventario"><form className="dashboard-form" onSubmit={guardarMovimiento}><Campo label="Producto"><select required value={movimientoForm.producto} onChange={(e) => setMovimientoForm({ ...movimientoForm, producto: e.target.value })}><option value="">Seleccionar</option>{productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.talla} · stock {p.stock}</option>)}</select></Campo><Campo label="Movimiento"><select value={movimientoForm.tipo} onChange={(e) => setMovimientoForm({ ...movimientoForm, tipo: e.target.value })}><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option><option value="AJUSTE">Ajustar stock a</option></select></Campo><Campo label="Cantidad"><input required type="number" min="1" value={movimientoForm.cantidad} onChange={(e) => setMovimientoForm({ ...movimientoForm, cantidad: e.target.value })} /></Campo><Campo label="Alumno opcional"><select value={movimientoForm.alumno} onChange={(e) => setMovimientoForm({ ...movimientoForm, alumno: e.target.value })}><option value="">Ninguno</option>{alumnos.map((a) => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}</select></Campo><Campo label="Motivo"><input required value={movimientoForm.motivo} onChange={(e) => setMovimientoForm({ ...movimientoForm, motivo: e.target.value })} /></Campo><button className="action-btn primary" disabled={saving}>Registrar movimiento</button></form><Tabla headers={['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo', 'Alumno']} rows={movimientos.slice(0, 100).map((m) => [fechaHora(m.fecha), m.producto_nombre, m.tipo, m.cantidad, m.motivo, m.alumno_nombre || '-'])} /></Panel></div>;
}

function Auditoria({ registros }) {
  return <Panel titulo="Auditoria administrativa" subtitulo="Historial de operaciones sensibles realizadas dentro de la Escuela."><Tabla headers={['Fecha', 'Usuario', 'Accion', 'Modulo', 'Descripcion']} rows={registros.slice(0, 250).map((r) => [fechaHora(r.fecha), r.usuario_nombre, r.accion, r.modelo, r.descripcion])} /></Panel>;
}

function Panel({ titulo, subtitulo, children }) { return <section className="data-panel"><div className="panel-header"><div><h3>{titulo}</h3>{subtitulo && <p>{subtitulo}</p>}</div></div>{children}</section>; }
function Campo({ label, children }) { return <label className="form-field"><span className="field-label">{label}</span>{children}</label>; }
function Tabla({ headers, rows }) { return <div className="table-wrap"><table className="dashboard-table"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td className="empty-cell" colSpan={headers.length}>No hay registros.</td></tr>}</tbody></table></div>; }
function Botones({ children }) { return <div className="table-actions">{children}</div>; }
function Stat({ titulo, valor }) { return <article className="stat-card escuela-stat"><div className="stat-content"><h3>{titulo}</h3><p className="stat-value">{valor}</p></div></article>; }
function hoy() { return new Date().toISOString().slice(0, 10); }
function fecha(valor) { return valor ? new Intl.DateTimeFormat('es-BO').format(new Date(`${valor}T12:00:00`)) : '-'; }
function fechaHora(valor) { return valor ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor)) : '-'; }
function moneda(valor) { return `Bs ${Number(valor || 0).toFixed(2)}`; }
function nombreUsuario(item) { return `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username; }
function errorLegible(error) { try { const data = JSON.parse(error.message); const valor = Object.values(data)[0]; return Array.isArray(valor) ? valor[0] : String(valor); } catch { return 'No se pudo completar la operacion.'; } }
