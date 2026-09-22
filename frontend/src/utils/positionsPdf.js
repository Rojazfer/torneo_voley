import { jsPDF } from 'jspdf';
import clubLogo from '../assets/club-logo.png';

const columns = [
  ['Pos', 12], ['Equipo', 72], ['PJ', 16], ['PG', 16], ['PP', 16],
  ['SF', 16], ['SC', 16], ['PF', 16], ['PC', 16], ['DIF', 18], ['PTS', 18],
];

export async function downloadStandingsPdf({ groups, fileName = 'tabla-posiciones' }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logo = await toDataUrl(clubLogo).catch(() => null);
  const margin = 14;
  const pageWidth = 297;
  const pageHeight = 210;
  let y = 42;

  const drawPageHeader = () => {
    doc.setFillColor(19, 24, 29);
    doc.rect(0, 0, pageWidth, 29, 'F');
    doc.setFillColor(177, 17, 25);
    doc.rect(0, 25, pageWidth, 4, 'F');
    if (logo) doc.addImage(logo, 'PNG', margin, 5, 17, 17);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('AYACUCHO CLUB DE VOLEIBOL', logo ? 36 : margin, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Tabla oficial de posiciones', logo ? 36 : margin, 20);
  };

  const drawTableHeader = () => {
    let x = margin;
    doc.setFillColor(235, 239, 243);
    doc.rect(margin, y - 5, columns.reduce((total, [, width]) => total + width, 0), 9, 'F');
    doc.setTextColor(65, 76, 90);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    columns.forEach(([label, width], index) => {
      doc.text(label, index === 1 ? x + 2 : x + width / 2, y, index === 1 ? undefined : { align: 'center' });
      x += width;
    });
    y += 7;
  };

  const nextPage = () => {
    doc.addPage('a4', 'landscape');
    drawPageHeader();
    y = 42;
  };

  drawPageHeader();
  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) y += 5;
    if (y > pageHeight - 28) nextPage();

    doc.setTextColor(25, 37, 31);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(group.title || 'Tabla de posiciones', margin, y);
    doc.setTextColor(95, 105, 99);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${group.category || 'Categoria general'} - ${group.rows.length} equipos`, pageWidth - margin, y, { align: 'right' });
    y += 9;
    drawTableHeader();

    group.rows.forEach((row) => {
      if (y > pageHeight - 15) {
        nextPage();
        doc.setTextColor(25, 37, 31);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`${group.title || 'Tabla de posiciones'} (continuacion)`, margin, y);
        y += 8;
        drawTableHeader();
      }

      const values = [row.posicion, row.equipo_nombre, row.pj, row.pg, row.pp, row.sf, row.sc, row.pf, row.pc, row.dif, row.pts];
      let x = margin;
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', row.posicion <= 3 ? 'bold' : 'normal');
      doc.setFontSize(8);
      values.forEach((value, index) => {
        const width = columns[index][1];
        const text = String(value ?? '-');
        doc.text(index === 1 ? text.slice(0, 38) : text, index === 1 ? x + 2 : x + width / 2, y, index === 1 ? { maxWidth: width - 4 } : { align: 'center' });
        x += width;
      });
      doc.setDrawColor(225, 230, 234);
      doc.line(margin, y + 3, margin + columns.reduce((total, [, width]) => total + width, 0), y + 3);
      y += 8;
    });
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setTextColor(110, 118, 128);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Generado por el Sistema de Torneos - Pagina ${page} de ${pages}`, margin, pageHeight - 6);
  }
  doc.save(`${slugify(fileName)}.pdf`);
}

function toDataUrl(url) {
  return fetch(url)
    .then((response) => response.blob())
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));
}

function slugify(value) {
  return String(value || 'tabla-posiciones').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
