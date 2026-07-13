import { getExportBodyHtml, getExportDocument } from "../utils/exportHtml";
import { createPrintSchedule, selectPrintDays, validatePrintSelection } from "./printSelection";
import { createPrintStyles, printLayoutClass } from "./printStyles";

function decorateMarkup(html) {
  return html
    .replaceAll('class="day-section', 'class="print-day day-section')
    .replaceAll('class="executive-day-section', 'class="print-day executive-day-section')
    .replaceAll('class="driver-section', 'class="print-driver-group driver-section');
}

export function createPrintDocument(schedule, config, context = {}) {
  const selection = validatePrintSelection(schedule, config, context);
  if (!selection.ok) return { ok: false, error: selection.message, selectedDays: [] };
  const printSchedule = createPrintSchedule(schedule, config, context);
  const generated = getExportDocument(printSchedule, config.view, { selectedDriverId: config.driverId });
  const selectedDays = selectPrintDays(schedule, config, context);
  let bodyHtml = decorateMarkup(generated.bodyHtml);
  if (config.include.importantInformation && config.view !== "importantInfo" && (schedule.importantInfoItems || []).length) {
    const infoHtml = getExportBodyHtml(schedule, "importantInfo");
    bodyHtml += `<section class="print-appended-information"><h2>Important Information</h2>${infoHtml}</section>`;
  }
  const styles = `${generated.styles}\n${createPrintStyles(config)}`;
  const bodyClass = printLayoutClass(config);
  const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${generated.title}</title><style>${styles}</style></head><body class="${bodyClass}">${bodyHtml}</body></html>`;
  return { ok: true, title: generated.title, selectedDays, selectedDayCount: config.view === "importantInfo" ? 0 : selectedDays.length, bodyHtml, styles, fullHtml, config, schedule: printSchedule };
}
