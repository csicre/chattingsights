/**
 * Exportación del informe a imagen (PNG) o PDF.
 * Captura un nodo del DOM con html-to-image y, para PDF, lo pagina con jsPDF.
 * Todo ocurre en el cliente.
 */

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const EXPORT_OPTS = {
  pixelRatio: 2,
  backgroundColor: '#ffffff',
  cacheBust: true,
};

function triggerDownload(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/** Exporta el nodo dado como PNG. */
export async function exportAsImage(node: HTMLElement, filename = 'chattingsights-report.png'): Promise<void> {
  const dataUrl = await toPng(node, EXPORT_OPTS);
  triggerDownload(dataUrl, filename);
}

/** Exporta el nodo dado como PDF A4, paginando si es más alto que una página. */
export async function exportAsPdf(node: HTMLElement, filename = 'chattingsights-report.pdf'): Promise<void> {
  const dataUrl = await toPng(node, EXPORT_OPTS);

  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para el PDF'));
  });

  const pdf = new jsPDF({ unit: 'px', format: 'a4', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Escala la imagen al ancho de página y pagina verticalmente.
  const imgW = pageW;
  const imgH = (img.height * pageW) / img.width;

  let remaining = imgH;
  let position = 0;

  pdf.addImage(dataUrl, 'PNG', 0, position, imgW, imgH);
  remaining -= pageH;

  while (remaining > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(dataUrl, 'PNG', 0, position, imgW, imgH);
    remaining -= pageH;
  }

  pdf.save(filename);
}
