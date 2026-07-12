export function preparePreviewDocument(createDocument) {
  try {
    const document = createDocument();
    const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><title>${document.title}</title><style>${document.styles}</style></head><body>${document.bodyHtml}</body></html>`;
    return { ok: true, document, srcDoc };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
