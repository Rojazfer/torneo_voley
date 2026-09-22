import { jsPDF } from 'jspdf';
import clubLogo from '../assets/club-logo.png';
import { GERENTE_CELULAR } from '../config/escuela';

export const FORMATOS_COMPROBANTE = [
  { value: 'MEDIA_CARTA', label: 'Media carta (215.9 x 139.7 mm)' },
  { value: 'TERMICO_80', label: 'Termico 80 mm' },
  { value: 'TERMICO_58', label: 'Termico 58 mm' },
];

const formatos = {
  MEDIA_CARTA: { ancho: 215.9, alto: 139.7, margen: 12, termico: false },
  TERMICO_80: { ancho: 80, margen: 5, termico: true },
  TERMICO_58: { ancho: 58, margen: 4, termico: true },
};

const rojo = [177, 17, 25];
const oscuro = [25, 29, 36];
const gris = [98, 105, 117];
const verde = [23, 96, 68];

function moneda(valor) {
  return `Bs ${Number(valor || 0).toFixed(2)}`;
}

function fechaBonita(valor) {
  return valor ? new Intl.DateTimeFormat('es-BO').format(new Date(`${valor}T12:00:00`)) : '-';
}

function periodoBonito(valor) {
  return valor
    ? new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' }).format(new Date(`${valor.slice(0, 7)}-01T12:00:00`))
    : '-';
}

async function cargarLogo() {
  const respuesta = await fetch(clubLogo);
  const blob = await respuesta.blob();
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = reject;
    lector.readAsDataURL(blob);
  });
}

function crearDocumento(formato, altoTermico) {
  const medidas = formatos[formato] || formatos.MEDIA_CARTA;
  const alto = medidas.termico ? altoTermico : medidas.alto;
  const doc = new jsPDF({
    orientation: medidas.termico ? 'portrait' : 'landscape',
    unit: 'mm',
    format: [medidas.ancho, alto],
  });
  return { doc, medidas: { ...medidas, alto } };
}

function textoAjustado(doc, texto, ancho) {
  return doc.splitTextToSize(String(texto || '-'), ancho);
}

function lineaDato(doc, etiqueta, valor, x, y, ancho, termico) {
  doc.setTextColor(...gris);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(termico ? 6.6 : 7.5);
  doc.text(etiqueta.toUpperCase(), x, y);
  doc.setTextColor(...oscuro);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(termico ? 8 : 9.5);
  const lineas = textoAjustado(doc, valor, ancho);
  doc.text(lineas, x, y + (termico ? 4 : 4.8));
  return y + (termico ? 8 + Math.max(0, lineas.length - 1) * 3.5 : 10);
}

async function encabezado(doc, medidas, titulo, referencia) {
  const { ancho, margen, termico } = medidas;
  doc.setFillColor(...rojo);
  doc.rect(0, 0, ancho, termico ? 3 : 4, 'F');

  if (termico) {
    try { doc.addImage(await cargarLogo(), 'PNG', (ancho - 15) / 2, 7, 15, 15); } catch { /* Documento valido sin logo. */ }
    doc.setTextColor(...oscuro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(ancho === 58 ? 9 : 10.5);
    doc.text('AYACUCHO CLUB DE VOLEIBOL', ancho / 2, 27, { align: 'center', maxWidth: ancho - (margen * 2) });
    doc.setTextColor(...gris);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Escuela de voleibol', ancho / 2, 32, { align: 'center' });
    doc.setDrawColor(215, 219, 225);
    doc.line(margen, 36, ancho - margen, 36);
    doc.setTextColor(...oscuro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(titulo, ancho / 2, 42, { align: 'center' });
    doc.setFontSize(7.5);
    doc.text(referencia, ancho / 2, 47, { align: 'center' });
    return 54;
  }

  try { doc.addImage(await cargarLogo(), 'PNG', margen, 11, 20, 20); } catch { /* Documento valido sin logo. */ }
  doc.setTextColor(...oscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('AYACUCHO CLUB DE VOLEIBOL', margen + 27, 18);
  doc.setTextColor(...gris);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Escuela de voleibol | Gestion academica y cobranza', margen + 27, 24);
  doc.setTextColor(...oscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(titulo, ancho - margen, 17, { align: 'right' });
  doc.setTextColor(...rojo);
  doc.setFontSize(9);
  doc.text(referencia, ancho - margen, 24, { align: 'right' });
  doc.setDrawColor(215, 219, 225);
  doc.line(margen, 36, ancho - margen, 36);
  return 45;
}

export async function crearReciboPdf(pago, mensualidad, formato = 'MEDIA_CARTA') {
  const { doc, medidas } = crearDocumento(formato, formato === 'TERMICO_58' ? 132 : 126);
  const { ancho, margen, termico } = medidas;
  const referencia = `Nro. ${pago.numero_recibo || pago.id}`;
  let y = await encabezado(doc, medidas, 'RECIBO DE PAGO', referencia);

  if (termico) {
    y = lineaDato(doc, 'Alumno', mensualidad.alumno_nombre, margen, y, ancho - (margen * 2), true);
    y = lineaDato(doc, 'Categoria', mensualidad.categoria_nombre, margen, y, ancho - (margen * 2), true);
    y = lineaDato(doc, 'Periodo', periodoBonito(mensualidad.periodo), margen, y, ancho - (margen * 2), true);
    y = lineaDato(doc, 'Fecha y metodo', `${fechaBonita(pago.fecha_pago)} | ${pago.metodo}`, margen, y, ancho - (margen * 2), true);
    doc.setFillColor(242, 247, 244);
    doc.setDrawColor(...verde);
    doc.roundedRect(margen, y + 1, ancho - (margen * 2), 19, 2, 2, 'FD');
    doc.setTextColor(...verde);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('IMPORTE RECIBIDO', ancho / 2, y + 7, { align: 'center' });
    doc.setFontSize(ancho === 58 ? 15 : 17);
    doc.text(moneda(pago.monto), ancho / 2, y + 15, { align: 'center' });
    y += 27;
    doc.setTextColor(...gris);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`Gerencia: ${GERENTE_CELULAR}`, ancho / 2, y, { align: 'center' });
    doc.text('Gracias por su pago.', ancho / 2, y + 5, { align: 'center' });
    doc.text('Comprobante generado por el sistema.', ancho / 2, y + 9, { align: 'center' });
    return doc;
  }

  const columna = (ancho - (margen * 2) - 10) / 2;
  lineaDato(doc, 'Alumno', mensualidad.alumno_nombre, margen, y, columna, false);
  lineaDato(doc, 'Categoria', mensualidad.categoria_nombre, margen, y + 13, columna, false);
  lineaDato(doc, 'Periodo', periodoBonito(mensualidad.periodo), margen + columna + 10, y, columna, false);
  lineaDato(doc, 'Fecha y metodo', `${fechaBonita(pago.fecha_pago)} | ${pago.metodo}`, margen + columna + 10, y + 13, columna, false);
  doc.setFillColor(242, 247, 244);
  doc.setDrawColor(...verde);
  doc.roundedRect(margen, 78, ancho - (margen * 2), 27, 3, 3, 'FD');
  doc.setTextColor(...verde);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('IMPORTE RECIBIDO', margen + 8, 89);
  doc.setFontSize(22);
  doc.text(moneda(pago.monto), ancho - margen - 8, 94, { align: 'right' });
  doc.setTextColor(...gris);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Contacto de gerencia: ${GERENTE_CELULAR}`, margen, 119);
  doc.text('Gracias por su pago. Comprobante generado por el sistema.', ancho - margen, 119, { align: 'right' });
  return doc;
}

export async function crearFacturaInternaPdf(mensualidad, formato = 'MEDIA_CARTA') {
  const { doc, medidas } = crearDocumento(formato, formato === 'TERMICO_58' ? 154 : 145);
  const { ancho, margen, termico } = medidas;
  const referencia = `Nro. MEN-${String(mensualidad.id).padStart(6, '0')}`;
  let y = await encabezado(doc, medidas, 'FACTURA INTERNA', referencia);

  y = lineaDato(doc, 'Alumno', mensualidad.alumno_nombre, margen, y, ancho - (margen * 2), termico);
  y = lineaDato(doc, 'Categoria', mensualidad.categoria_nombre, margen, y, ancho - (margen * 2), termico);
  if (termico) {
    y = lineaDato(doc, 'Periodo', periodoBonito(mensualidad.periodo), margen, y, ancho - (margen * 2), true);
    y = lineaDato(doc, 'Vencimiento', fechaBonita(mensualidad.fecha_vencimiento), margen, y, ancho - (margen * 2), true);
  } else {
    lineaDato(doc, 'Periodo', periodoBonito(mensualidad.periodo), ancho / 2, 45, (ancho / 2) - margen, false);
    lineaDato(doc, 'Vencimiento', fechaBonita(mensualidad.fecha_vencimiento), ancho / 2, 58, (ancho / 2) - margen, false);
  }

  const montoBase = Number(mensualidad.monto_base || mensualidad.monto);
  const descuento = Number(mensualidad.descuento_aplicado || 0);
  const total = Number(mensualidad.monto || 0);
  const pagado = Number(mensualidad.total_pagado || 0);
  const saldo = Number(mensualidad.saldo || 0);
  const cajaY = termico ? y + 1 : 79;
  const cajaAlto = termico ? 34 : 29;
  doc.setFillColor(247, 248, 250);
  doc.setDrawColor(215, 219, 225);
  doc.roundedRect(margen, cajaY, ancho - (margen * 2), cajaAlto, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(termico ? 7 : 8.5);
  doc.setTextColor(...gris);
  const conceptos = [
    ['Mensualidad', montoBase],
    ['Descuento', -descuento],
    ['Total', total],
    ['Pagado', pagado],
  ];
  conceptos.forEach(([etiqueta, valor], indice) => {
    const filaY = cajaY + 6 + (indice * (termico ? 5.3 : 5));
    doc.text(etiqueta, margen + 5, filaY);
    doc.text(moneda(valor), ancho - margen - 5, filaY, { align: 'right' });
  });
  doc.setDrawColor(...rojo);
  doc.line(margen + 5, cajaY + cajaAlto - 8, ancho - margen - 5, cajaY + cajaAlto - 8);
  doc.setTextColor(...rojo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(termico ? 9 : 11);
  doc.text(`SALDO ${moneda(saldo)}`, ancho - margen - 5, cajaY + cajaAlto - 3, { align: 'right' });
  doc.setTextColor(...gris);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const pieY = termico ? cajaY + cajaAlto + 9 : 121;
  doc.text('DOCUMENTO INTERNO - SIN VALOR FISCAL', ancho / 2, pieY, { align: 'center' });
  doc.text(`Gerencia: ${GERENTE_CELULAR}`, ancho / 2, pieY + 5, { align: 'center' });
  return doc;
}

export async function crearEstadoCuentaPdf(mensualidad, cuenta, formato = 'MEDIA_CARTA') {
  const filas = [...cuenta].sort((a, b) => a.periodo.localeCompare(b.periodo));
  const altoTermico = Math.max(150, 116 + (filas.length * 8));
  const { doc, medidas } = crearDocumento(formato, altoTermico);
  const { ancho, margen, termico } = medidas;
  const totalCargos = filas.reduce((total, item) => total + Number(item.monto), 0);
  const totalPagado = filas.reduce((total, item) => total + Number(item.total_pagado), 0);
  const saldo = filas.reduce((total, item) => total + Number(item.saldo), 0);
  let y = await encabezado(doc, medidas, 'ESTADO DE CUENTA', mensualidad.alumno_nombre);

  y = lineaDato(doc, 'Categoria', mensualidad.categoria_nombre, margen, y, ancho - (margen * 2), termico);
  const cajaAlto = termico ? 26 : 21;
  doc.setFillColor(247, 248, 250);
  doc.setDrawColor(215, 219, 225);
  doc.roundedRect(margen, y, ancho - (margen * 2), cajaAlto, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(termico ? 7 : 8);
  doc.setTextColor(...gris);
  doc.text('CARGOS', margen + 4, y + 7);
  doc.text('PAGADO', termico ? margen + 4 : ancho / 2 - 12, y + (termico ? 15 : 7));
  doc.setTextColor(...oscuro);
  doc.text(moneda(totalCargos), ancho - margen - 4, y + 7, { align: 'right' });
  doc.text(moneda(totalPagado), ancho - margen - 4, y + (termico ? 15 : 7), { align: 'right' });
  doc.setTextColor(...rojo);
  doc.setFontSize(termico ? 9 : 11);
  doc.text(`SALDO ${moneda(saldo)}`, ancho - margen - 4, y + cajaAlto - 4, { align: 'right' });
  y += cajaAlto + 9;

  doc.setFontSize(termico ? 6.2 : 7.5);
  filas.forEach((item) => {
    doc.setTextColor(...oscuro);
    doc.setFont('helvetica', 'bold');
    doc.text(periodoBonito(item.periodo), margen, y, { maxWidth: termico ? ancho * 0.44 : 55 });
    doc.setFont('helvetica', 'normal');
    doc.text(moneda(item.saldo), ancho - margen, y, { align: 'right' });
    doc.setTextColor(...gris);
    doc.text(`${item.estado} | Cargo ${moneda(item.monto)} | Pagado ${moneda(item.total_pagado)}`, margen, y + 3.8, { maxWidth: ancho - (margen * 2) });
    doc.setDrawColor(230, 232, 236);
    doc.line(margen, y + 6, ancho - margen, y + 6);
    y += 8;
  });
  doc.setTextColor(...gris);
  doc.setFontSize(6.5);
  doc.text(`Gerencia: ${GERENTE_CELULAR}`, margen, medidas.alto - 7);
  return doc;
}
