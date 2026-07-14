export function preparePreviewDocument(createDocument) {
  try {
    const document = createDocument();
    return { ok: true, document };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
