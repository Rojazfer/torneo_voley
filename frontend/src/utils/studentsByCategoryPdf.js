import { jsPDF } from 'jspdf';
import clubLogo from '../assets/club-logo.png';
import { GERENTE_CELULAR } from '../config/escuela';

const rojo = [177, 17, 25];
const oscuro = [25, 29, 36];
const gris = [98, 105, 117];

function fecha(valor) {
  return valor ? new Intl.DateTimeFormat('es-BO').format(new Date(`${valor}T12:00:00`)) : '-';
}

function moneda(valor) {
  return `Bs ${Number(valor || 0).toFixed(2)}`;
}

async function imagenDataUrl(origen) {
  const respuesta = await fetch(origen);
  const blob = await respuesta.blob();
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = reject;
    lector.readAsDataURL(blob);
  });
}

function nombreAlumno(alumno) {
  return alumno.nombre_completo || `${alumno.nombres || ''} ${alumno.apellidos || ''}`.trim();
}

function escribirEncabezado(doc, titulo, subtitulo) {
  doc.setFillColor(...rojo);
  doc.rect(0, 0, 297, 5, 'F');
  doc.setTextColor(...oscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(titulo, 18, 19);
  doc.setTextColor(...gris);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitulo, 18, 26);
  doc.text(`Generado: ${fecha(new Date().toISOString().slice(0, 10))}`, 18, 32);
  doc.text(`Gerencia: ${GERENTE_CELULAR}`, 246, 32, { align: 'right' });
}

function escribirCabeceraTabla(doc, y) {
  doc.setFillColor(247, 248, 250);
  doc.setDrawColor(215, 219, 225);
  doc.rect(18, y - 5, 261, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...gris);
  doc.text('Nro.', 21, y);
  doc.text('Alumno', 35, y);
  doc.text('Documento', 92, y);
  doc.text('Tutor', 124, y);
  doc.text('WhatsApp', 176, y);
  doc.text('Ingreso', 205, y);
  doc.text('Mensualidad', 231, y);
  doc.text('Estado', 263, y);
}

function verificarPagina(doc, y) {
  if (y <= 190) return y;
  doc.addPage();
  escribirEncabezado(doc, 'LISTA DE INSCRITOS', 'Alumnos agrupados por categoria');
  return 45;
}

export async function crearListaInscritosPdf(alumnos, categorias) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  try { doc.addImage(await imagenDataUrl(clubLogo), 'PNG', 255, 12, 22, 22); } catch { /* El PDF sigue disponible sin logo. */ }
  escribirEncabezado(doc, 'LISTA DE INSCRITOS', 'Alumnos registrados por categoria');

  const categoriasOrdenadas = [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const alumnosOrdenados = [...alumnos].sort((a, b) => {
    const categoria = String(a.categoria_nombre || '').localeCompare(String(b.categoria_nombre || ''), 'es');
    return categoria || nombreAlumno(a).localeCompare(nombreAlumno(b), 'es');
  });

  let y = 45;
  let total = 0;
  categoriasOrdenadas.forEach((categoria) => {
    const inscritos = alumnosOrdenados.filter((alumno) => String(alumno.categoria) === String(categoria.id));
    if (!inscritos.length) return;
    y = verificarPagina(doc, y + 4);
    doc.setTextColor(...rojo);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${categoria.nombre} (${inscritos.length})`, 18, y);
    doc.setTextColor(...gris);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Mensualidad: ${moneda(categoria.monto_mensual)} | Vence dia ${categoria.dia_vencimiento}`, 205, y, { align: 'right' });
    y += 9;
    escribirCabeceraTabla(doc, y);
    y += 7;

    inscritos.forEach((alumno, indice) => {
      y = verificarPagina(doc, y);
      if (y === 45) {
        doc.setTextColor(...rojo);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`${categoria.nombre} (continuacion)`, 18, y);
        y += 9;
        escribirCabeceraTabla(doc, y);
        y += 7;
      }
      doc.setTextColor(...oscuro);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const nombre = doc.splitTextToSize(nombreAlumno(alumno), 52);
      doc.text(String(indice + 1), 21, y);
      doc.text(nombre, 35, y);
      doc.text(alumno.documento || '-', 92, y);
      doc.text(doc.splitTextToSize(alumno.tutor_nombre || '-', 48), 124, y);
      doc.text(alumno.tutor_telefono || '-', 176, y);
      doc.text(fecha(alumno.fecha_inscripcion), 205, y);
      doc.text(moneda(alumno.monto_mensual), 231, y);
      doc.text(alumno.estado || '-', 263, y);
      doc.setDrawColor(230, 232, 236);
      doc.line(18, y + 3.5, 279, y + 3.5);
      y += Math.max(7, nombre.length * 4);
      total += 1;
    });
  });

  if (!total) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...gris);
    doc.text('No hay alumnos para los filtros seleccionados.', 18, y);
  }

  doc.setProperties({ title: 'Lista de inscritos por categoria' });
  return doc;
}
