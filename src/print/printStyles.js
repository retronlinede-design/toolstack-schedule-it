const density = {
  spacious: { body: "11pt", small: "10pt", title: "22pt", row: "9px 10px", gap: "18px", margin: "15mm" },
  standard: { body: "10pt", small: "9.5pt", title: "20pt", row: "7px 8px", gap: "14px", margin: "12mm" },
  compact: { body: "9.5pt", small: "9.5pt", title: "17pt", row: "4px 5px", gap: "8px", margin: "9mm" },
};

export function printLayoutClass(config) {
  return `print-document print-layout-${config.layout} print-density-${config.density} print-orientation-${config.orientation} print-driver-grouping-${config.driverGrouping}`;
}

export function createPrintStyles(config) {
  const values = density[config.density] || density.standard;
  const orientation = config.orientation === "landscape" ? "landscape" : "portrait";
  return `
    :root {
      --print-body-size: ${values.body};
      --print-small-size: ${values.small};
      --print-title-size: ${values.title};
      --print-row-padding: ${values.row};
      --print-section-gap: ${values.gap};
      --print-page-margin: ${values.margin};
    }
    @page { size: A4 ${orientation}; margin: ${values.margin}; }
    body.print-document, body.print-document table { font-size: var(--print-body-size) !important; }
    body.print-document th, body.print-document .small-cell, body.print-document .address-cell { font-size: var(--print-small-size) !important; }
    body.print-document th, body.print-document td { padding: var(--print-row-padding) !important; overflow-wrap: anywhere; }
    body.print-document h1, body.print-document h2 { font-size: var(--print-title-size); }
    body.print-document .print-day { margin-bottom: var(--print-section-gap); overflow: visible; }
    body.print-layout-separate .print-day + .print-day { break-before: page; page-break-before: always; }
    body.print-layout-continuous .print-day, body.print-layout-compact .print-day { break-before: auto; page-break-before: auto; break-inside: auto; page-break-inside: auto; }
    body.print-layout-smart .print-day { break-inside: avoid; page-break-inside: avoid; }
    body.print-layout-compact .print-day { margin-bottom: 6px; }
    body.print-layout-compact .wrap-cell { white-space: normal; }
    body.print-driver-grouping-driver .print-driver-group + .print-driver-group { break-before: page; page-break-before: always; }
    body.print-driver-grouping-driverDay .print-driver-group { break-before: page; page-break-before: always; }
    body.print-driver-grouping-driverDay .print-day:first-child .print-driver-group:first-child { break-before: auto; page-break-before: auto; }
    ${config.keepMovementTogether ? "body.print-document tr { break-inside: avoid; page-break-inside: avoid; }" : "body.print-document tr { break-inside: auto; page-break-inside: auto; }"}
    ${config.keepDayHeadingWithFirstMovement ? "body.print-document .day-heading, body.print-document .executive-day-heading { break-after: avoid; page-break-after: avoid; }" : ""}
    ${config.repeatTableHeaders ? "body.print-document thead { display: table-header-group; }" : "body.print-document thead { display: table-row-group; }"}
    ${config.include.missionHeader ? "" : "body.print-document header h1 { display: none; }"}
    ${config.include.documentTitle ? "" : "body.print-document header h2, body.print-document .document-meta { display: none; }"}
    ${config.include.dayTitle ? "" : "body.print-document .day-title, body.print-document .executive-day-title { display: none; }"}
    ${config.include.date ? "" : "body.print-document .day-date, body.print-document .executive-day-date, body.print-document .date-meta { display: none; }"}
  `;
}

export const PRINT_DENSITY_MINIMUM = "9.5pt";
