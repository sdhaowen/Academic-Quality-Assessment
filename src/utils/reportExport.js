import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportElementToPdf(element, { title, fileName }) {
  if (!element) {
    throw new Error("未找到可导出的报告区域。");
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const titleHeight = title ? 10 : 0;
  const printableWidth = pageWidth - margin * 2;
  const imageHeight = (canvas.height * printableWidth) / canvas.width;

  if (title) {
    pdf.setFontSize(14);
    pdf.text(title, margin, 10);
  }

  const totalPrintableHeight = pageHeight - margin * 2 - titleHeight;
  const pixelsPerMm = canvas.height / imageHeight;
  const pagePixelHeight = Math.floor(totalPrintableHeight * pixelsPerMm);

  if (imageHeight <= totalPrintableHeight) {
    const y = margin + titleHeight;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, y, printableWidth, imageHeight);
    pdf.save(fileName);
    return;
  }

  let renderedPixels = 0;
  let page = 0;

  while (renderedPixels < canvas.height) {
    const slicePixelHeight = Math.min(pagePixelHeight, canvas.height - renderedPixels);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = slicePixelHeight;
    const ctx = sliceCanvas.getContext("2d");
    ctx.drawImage(
      canvas,
      0,
      renderedPixels,
      canvas.width,
      slicePixelHeight,
      0,
      0,
      canvas.width,
      slicePixelHeight,
    );

    if (page > 0) {
      pdf.addPage();
    }

    const sliceHeightMm = slicePixelHeight / pixelsPerMm;
    const y = page === 0 ? margin + titleHeight : margin;
    pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", margin, y, printableWidth, sliceHeightMm);

    renderedPixels += slicePixelHeight;
    page += 1;
  }

  pdf.save(fileName);
}

export async function exportStudentReportPDF({ element, studentName, className, stageLabel }) {
  const date = new Date().toISOString().slice(0, 10);
  await exportElementToPdf(element, {
    title: `${stageLabel}学生成长报告 - ${studentName}（${className}）`,
    fileName: `学生报告_${studentName}_${date}.pdf`,
  });
}

export async function exportClassReportPDF({ element, className, stageLabel }) {
  const date = new Date().toISOString().slice(0, 10);
  await exportElementToPdf(element, {
    title: `${stageLabel}班级质量报告 - ${className}`,
    fileName: `班级报告_${className}_${date}.pdf`,
  });
}
