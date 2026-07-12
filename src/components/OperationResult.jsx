import { AlertTriangle, RotateCcw } from "lucide-react";
import AlertBanner from "./ui/AlertBanner";
import { Button } from "./ui/Button";

export default function OperationResult({ result, onRollback, onRetry, onDownloadCurrent, onDownloadCandidate }) {
  if (!result) return null;
  if (result.ok) return (
    <AlertBanner tone="success" className="mb-4">
      <strong>{result.message || "Operation completed."}</strong>
      <p className="mt-1">A verified snapshot was retained. Rollback is available.</p>
      <Button onClick={onRollback} variant="secondary" className="mt-3"><RotateCcw className="h-4 w-4" /> Restore Previous Schedule</Button>
      <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Advanced details</summary><p className="mt-1 break-all">Snapshot: {result.snapshotKey}</p></details>
    </AlertBanner>
  );
  return (
    <AlertBanner tone="danger" className="mb-4">
      <div className="flex gap-2"><AlertTriangle className="h-5 w-5 shrink-0" /><strong>{result.message || "The replacement failed. Current application data was not changed."}</strong></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry ? <Button onClick={onRetry} variant="danger-strong">Retry</Button> : null}
        <Button onClick={onDownloadCurrent} variant="danger">Download Current</Button>
        {result.candidate && onDownloadCandidate ? <Button onClick={onDownloadCandidate} variant="danger">Download Candidate</Button> : null}
      </div>
      <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Technical details</summary><pre className="mt-1 whitespace-pre-wrap">{result.errorCode}: {JSON.stringify(result.details, null, 2)}</pre></details>
    </AlertBanner>
  );
}
