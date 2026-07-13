const density = {
  standard: { documentTitle: "16pt", dayTitle: "12.5pt", sectionTitle: "11pt", body: "9.5pt", small: "8.5pt", row: "6px 7px", gap: "14px", margin: "12mm" },
  compact: { documentTitle: "14pt", dayTitle: "11.5pt", sectionTitle: "10pt", body: "8.75pt", small: "8pt", row: "4px 5px", gap: "9px", margin: "10mm" },
};

export function printLayoutClass(config) {
  return `print-document print-view-${config.view} print-layout-${config.layout} print-density-${config.density} print-orientation-${config.orientation}`;
}

export function createPrintStyles(config) {
  const values = density[config.density] || density.standard;
  const orientation = config.orientation === "landscape" ? "landscape" : "portrait";
  return `
    :root {
      --print-document-title: ${values.documentTitle};
      --print-day-title: ${values.dayTitle};
      --print-section-title: ${values.sectionTitle};
      --print-body-size: ${values.body};
      --print-small-size: ${values.small};
      --print-row-padding: ${values.row};
      --print-section-gap: ${values.gap};
      --print-page-margin: ${values.margin};
    }
    @page { size: A4 ${orientation}; margin: var(--print-page-margin); }
    body.print-document { font-size: var(--print-body-size); }
    body.print-document .page { width: 100%; max-width: none; }
    body.print-document .page > header h1 { font-size: var(--print-section-title); }
    body.print-document .page > header h2 { font-size: var(--print-document-title); }
    body.print-document .day-title,
    body.print-document .executive-day-title { font-size: var(--print-day-title); }
    body.print-document .driver-section-heading,
    body.print-document .summary-section h3,
    body.print-document .working-driver-heading h3,
    body.print-document .important-info-card h3,
    body.print-document .important-info-section-heading,
    body.print-document .handover-heading { font-size: var(--print-section-title); }
    body.print-document table { width: 100%; max-width: 100%; table-layout: auto; font-size: var(--print-body-size); }
    body.print-document table td,
    body.print-document table.executive-table td { font-size: var(--print-body-size); }
    body.print-document table th,
    body.print-document table td.address-cell,
    body.print-document table td.small-cell { font-size: var(--print-small-size); }
    body.print-document th,
    body.print-document td { padding: var(--print-row-padding); }
    body.print-document *,
    body.print-document th,
    body.print-document td,
    body.print-document h1,
    body.print-document h2,
    body.print-document h3,
    body.print-document .time-cell,
    body.print-document .wrap-cell {
      min-width: 0;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: normal;
      hyphens: auto;
      text-overflow: clip;
    }
    body.print-document .print-day { margin-bottom: var(--print-section-gap); overflow: visible; }
    body.print-layout-separate .print-day + .print-day { break-before: page; page-break-before: always; }
    body.print-layout-continuous .print-day { break-before: auto; page-break-before: auto; break-inside: auto; page-break-inside: auto; }
    body.print-layout-smart .print-day { break-inside: avoid; page-break-inside: avoid; overflow: visible; }
    body.print-document thead { display: table-header-group; }
    body.print-document tr { break-inside: avoid; page-break-inside: avoid; }
    body.print-document .day-heading,
    body.print-document .executive-day-heading { break-after: avoid; page-break-after: avoid; }
    body.print-document .working-driver-summary > *,
    body.print-document .daily-total-summary > *,
    body.print-document .important-info-details > * { min-width: 0; }
    body.print-document .details-cell,
    body.print-document .timeline-cell,
    body.print-document .important-info-notes { white-space: pre-line; }
  `;
}

export const PRINT_DENSITY_MINIMUM = "8.75pt";
