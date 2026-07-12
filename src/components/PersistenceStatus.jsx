import { AlertTriangle, Download, RefreshCw } from "lucide-react";

export default function PersistenceStatus({ persistence, onRetry, onExport }) {
  if (persistence.status === "saved") return <div className="text-xs font-semibold text-green-700">Saved</div>;
  if (persistence.status === "saving" || persistence.status === "initializing") return <div className="text-xs font-semibold text-amber-700">Saving…</div>;
  if (persistence.status === "unavailable") return <div className="rounded-xl bg-red-100 px-3 py-2 text-sm font-bold text-red-800">Volatile mode — storage unavailable</div>;
  return (
    <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900" role="alert">
      <div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0" /><strong>Changes are not safely stored and may be lost on reload.</strong></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-3 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Retry Save</button>
        <button onClick={onExport} className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold"><Download className="h-4 w-4" /> Export Current Data</button>
      </div>
      <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Technical details</summary><p className="mt-1">{persistence.error?.code}: {persistence.error?.message}</p></details>
    </div>
  );
}
