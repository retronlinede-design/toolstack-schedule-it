import { renderToStaticMarkup } from "react-dom/server";
import ProgrammeDocument from "../components/preview/ProgrammeDocument";
import { createProgrammeDocumentModel } from "../components/preview/programmeDocumentModel";

export function renderProgrammeDocumentMarkup(schedule, view, options = {}) {
  const model = createProgrammeDocumentModel(schedule, view, options);
  return {
    model,
    title: model.label,
    bodyHtml: renderToStaticMarkup(<ProgrammeDocument model={model} showControls={false} />),
  };
}
