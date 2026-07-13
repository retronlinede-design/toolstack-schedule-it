import { getExportDocument } from "../utils/exportHtml";
import { createPrintSchedule, selectPrintDays, validatePrintSelection } from "./printSelection";
import { createPrintStyles, printLayoutClass } from "./printStyles";

function decorateMarkup(html) {
  return html
    .replaceAll('class="day-section', 'class="print-day day-section')
    .replaceAll('class="executive-day-section', 'class="print-day executive-day-section');
}

export function createPrintDocument(schedule, config) {
  const selection = validatePrintSelection(schedule, config);
  if (!selection.ok) return { ok: false, error: selection.message, selectedDays: [] };
  const printSchedule = createPrintSchedule(schedule, config);
  const generated = getExportDocument(printSchedule, config.view, { selectedDriverId: config.driverId });
  const selectedDays = selectPrintDays(schedule, config);
  const bodyHtml = decorateMarkup(generated.bodyHtml);
  const styles = `${generated.styles}\n${createPrintStyles(config)}`;
  const bodyClass = printLayoutClass(config);
  const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${generated.title}</title><style>${styles}</style></head><body class="${bodyClass}">${bodyHtml}</body></html>`;
  return { ok: true, title: generated.title, selectedDays, selectedDayCount: config.view === "importantInfo" ? 0 : selectedDays.length, bodyHtml, styles, fullHtml, config, schedule: printSchedule };
}
