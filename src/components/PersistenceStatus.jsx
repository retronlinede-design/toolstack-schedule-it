import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import Badge from "./ui/Badge";
import AlertBanner from "./ui/AlertBanner";
import { Button } from "./ui/Button";

export default function PersistenceStatus({ persistence, onRetry, onExport }) {
  if (persistence.status === "saved") return <Badge tone="success">Saved</Badge>;
  if (persistence.status === "saving" || persistence.status === "initializing") return <Badge tone="warning">Saving…</Badge>;
  if (persistence.status === "unavailable") return <Badge tone="danger">Volatile mode — storage unavailable</Badge>;
  return (
    <AlertBanner tone="danger">
      <div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0" /><strong>Changes are not safely stored and may be lost on reload.</strong></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={onRetry} variant="danger-strong"><RefreshCw className="h-4 w-4" /> Retry Save</Button>
        <Button onClick={onExport} variant="danger"><Download className="h-4 w-4" /> Export Current Data</Button>
      </div>
      <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Technical details</summary><p className="mt-1">{persistence.error?.code}: {persistence.error?.message}</p></details>
    </AlertBanner>
  );
}
