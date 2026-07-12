import { AlertTriangle, RotateCcw } from "lucide-react";

export default function OperationResult({ result, onRollback, onRetry, onDownloadCurrent, onDownloadCandidate }) {
  if (!result) return null;
  if (result.ok) return (
    <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
      <strong>{result.message || "Operation completed."}</strong>
      <p className="mt-1">A verified snapshot was retained. Rollback is available.</p>
      <button onClick={onRollback} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-green-800 px-3 py-2 font-semibold text-white"><RotateCcw className="h-4 w-4" /> Restore Previous Schedule</button>
      <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Advanced details</summary><p className="mt-1 break-all">Snapshot: {result.snapshotKey}</p></details>
    </div>
  );
  return (
    <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">
      <div className="flex gap-2"><AlertTriangle className="h-5 w-5 shrink-0" /><strong>{result.message || "The replacement failed. Current application data was not changed."}</strong></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry ? <button onClick={onRetry} className="rounded-xl bg-red-700 px-3 py-2 font-semibold text-white">Retry</button> : null}
        <button onClick={onDownloadCurrent} className="rounded-xl border border-red-300 px-3 py-2 font-semibold">Download Current</button>
        {result.candidate && onDownloadCandidate ? <button onClick={onDownloadCandidate} className="rounded-xl border border-red-300 px-3 py-2 font-semibold">Download Candidate</button> : null}
      </div>
      <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Technical details</summary><pre className="mt-1 whitespace-pre-wrap">{result.errorCode}: {JSON.stringify(result.details, null, 2)}</pre></details>
    </div>
  );
}
