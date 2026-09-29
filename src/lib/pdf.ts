import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════
   PDF EXPORT — download a note as a PDF file.

   • Renders the note's HTML (already sanitized by the editors) into an
     offscreen A4-styled container, captures it with html2canvas and lays
     the bitmap into jsPDF pages.
   • Lazy-imports both libraries so they stay in a separate chunk and are
     only fetched when the user actually taps Download.
   • Works offline / client-side only — note content never leaves the
     device.
   ═══════════════════════════════════════════════════════════════════════ */

export async function downloadNoteAsPdf(
  title: string,
  html: string,
): Promise<void> {
  if (!html.trim()) {
    toast.error("Nothing to export — the note is empty.");
    return;
  }
  toast.info("Preparing PDF…");

  try {
    const [{ jsPDF: JsPdfCtor }, html2canvasMod] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);
    type Html2CanvasFn = (
      el: HTMLElement,
      opts?: Record<string, unknown>,
    ) => Promise<HTMLCanvasElement>;
    const renderCanvas: Html2CanvasFn =
      html2canvasMod.default ?? (html2canvasMod as unknown as Html2CanvasFn);
    const pdf = new JsPdfCtor({ unit: "pt", format: "a4" });

    // Offscreen render container styled like the app's paper.
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = "794px"; // A4 @ 96dpi
    container.style.background = "#ffffff";
    container.style.color = "#1e293b";
    container.style.padding = "48px 56px";
    container.style.fontFamily =
      'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
    container.style.fontSize = "14px";
    container.style.lineHeight = "1.6";
    container.innerHTML = `
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">Cerevyn · exported note</div>
      <div style="font-size:24px;font-weight:800;margin-bottom:16px;">${escapeHtml(title)}</div>
      ${html}
    `;
    // Basic content styling matching the editors' surfaces.
    const style = document.createElement("style");
    style.textContent = `
      [data-pdf-container] h1 { font-size: 22px; font-weight: 700; margin: 0 0 10px; }
      [data-pdf-container] h2 { font-size: 18px; font-weight: 700; margin: 18px 0 8px; }
      [data-pdf-container] h3 { font-size: 15px; font-weight: 700; margin: 14px 0 6px; }
      [data-pdf-container] p  { margin: 0 0 10px; }
      [data-pdf-container] ul, [data-pdf-container] ol { margin: 0 0 12px; padding-left: 22px; }
      [data-pdf-container] li { margin: 4px 0; }
      [data-pdf-container] code { background:#f1f5f9; padding:1px 5px; border-radius:4px; font-size:13px; }
      [data-pdf-container] strong { font-weight: 700; }
      [data-pdf-container] img { max-width: 100%; }
    `;
    document.head.appendChild(style);
    container.setAttribute("data-pdf-container", "");
    document.body.appendChild(container);

    try {
      const canvas = await renderCanvas(container, {
        scale: Math.min(window.devicePixelRatio || 1, 2),
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const usableW = pageW - margin * 2;
      const imgH = (canvas.height / canvas.width) * usableW;

      if (imgH <= pageH - margin * 2) {
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, usableW, imgH);
      } else {
        // Slice tall content across pages at pixel boundaries.
        const pxPerPage = Math.floor(
          ((pageH - margin * 2) * canvas.width) / usableW,
        );
        let y = 0;
        while (y < canvas.height) {
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = Math.min(pxPerPage, canvas.height - y);
          const pctx = pageCanvas.getContext("2d");
          if (!pctx) break;
          pctx.fillStyle = "#ffffff";
          pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pctx.drawImage(
            canvas,
            0,
            y,
            canvas.width,
            pageCanvas.height,
            0,
            0,
            canvas.width,
            pageCanvas.height,
          );
          if (y > 0) pdf.addPage();
          pdf.addImage(
            pageCanvas.toDataURL("image/jpeg", 0.92),
            "JPEG",
            margin,
            margin,
            usableW,
            (pageCanvas.height / canvas.width) * usableW,
          );
          y += pxPerPage;
        }
      }

      pdf.save(`${sanitizeFilename(title)}.pdf`);
      toast.success("PDF downloaded");
    } finally {
      container.remove();
      style.remove();
    }
  } catch {
    toast.error("Could not generate the PDF. Please try again.");
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeFilename(s: string): string {
  return (
    s
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "note"
  );
}
