import AlertBanner from "../ui/AlertBanner";
import { Button } from "../ui/Button";
import ModalShell from "../ui/ModalShell";

export default function PreviewUnavailable({ error, onClose }) {
  return <ModalShell title="Preview unavailable" subtitle="Official programme preview" onClose={onClose} maxWidth="max-w-xl">
    <AlertBanner tone="danger"><strong>The preview document could not be prepared.</strong></AlertBanner>
    <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={onClose}>Close</Button></div>
    {error ? <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Technical details</summary><p className="mt-2 break-words text-[var(--ts-text-muted)]">{error.message || String(error)}</p></details> : null}
  </ModalShell>;
}
