import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { defaultScheduleState } from "../data/defaultData";
import { downloadRaw, replaceCorruptWithNew } from "../storage/recovery";
import { APP_KEY } from "../utils/storage";

function downloadSource(label, source) {
  if (source?.status === "found") downloadRaw(`schedule-it-legacy-${label}.json`, source.raw);
}

export default function StorageGate({ startup, onRetry, onResolved, onVolatile }) {
  const unavailable = startup.status === "unavailable";
  const recovery = startup.status === "recovery-required";
  const migration = startup.status === "migration-failed";

  function startNew() {
    if (!window.confirm("Start a new schedule? The corrupt primary value will be preserved again before replacement.")) return;
    const result = replaceCorruptWithNew({
      storage: globalThis.localStorage,
      primaryKey: APP_KEY,
      raw: startup.raw,
      newState: defaultScheduleState,
      confirmed: true,
    });
    if (result.ok) onResolved({ ok: true, status: "found", value: result.value, savedAt: result.savedAt });
    else onResolved({ ...startup, actionError: result });
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-4 text-neutral-900 sm:p-8">
      <section className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-6 shadow-xl" role="alert">
        <div className="flex items-start gap-4">
          <AlertTriangle className="mt-1 h-7 w-7 shrink-0 text-red-600" />
          <div>
            <h1 className="text-2xl font-black">Schedule-It storage protection</h1>
            <p className="mt-2 text-sm text-neutral-700">
              {unavailable && "Browser storage is unavailable. Schedule-It cannot safely save data, so editing is blocked."}
              {recovery && "The primary schedule data is corrupt or invalid. It has not been replaced, and normal editing is blocked."}
              {migration && "Legacy data could not be migrated transactionally. The legacy sources remain intact."}
            </p>
          </div>
        </div>

        {startup.recovery ? (
          <p className={`mt-4 rounded-xl p-3 text-sm ${startup.recovery.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {startup.recovery.ok ? `An exact recovery copy was verified at ${startup.recovery.key}.` : "The recovery copy could not be verified. The primary value remains untouched."}
          </p>
        ) : null}
        {startup.actionError ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{startup.actionError.message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
            <RefreshCw className="h-4 w-4" /> {migration ? "Retry migration" : "Retry storage"}
          </button>
          {recovery ? (
            <>
              <button onClick={() => downloadRaw("schedule-it-corrupt-primary-recovery.txt", startup.raw)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold">
                <Download className="h-4 w-4" /> Download raw recovery data
              </button>
              <button onClick={startNew} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">Start with new schedule</button>
            </>
          ) : null}
          {migration ? (
            <>
              <button onClick={() => downloadSource("form", startup.sources?.form)} disabled={startup.sources?.form?.status !== "found"} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Download legacy form</button>
              <button onClick={() => downloadSource("entries", startup.sources?.entries)} disabled={startup.sources?.entries?.status !== "found"} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Download legacy entries</button>
              {startup.candidate ? <button onClick={() => window.confirm("Continue with migrated data in volatile memory? Changes will not be saved.") && onVolatile(startup.candidate)} className="rounded-xl border border-amber-300 px-4 py-2 text-sm text-amber-800">Use volatile migrated data</button> : null}
            </>
          ) : null}
        </div>

        <details className="mt-6 rounded-xl bg-neutral-50 p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Technical details</summary>
          <pre className="mt-2 whitespace-pre-wrap">{startup.code || startup.error?.message || startup.actionError?.code || "Storage access failed."}</pre>
        </details>
      </section>
    </main>
  );
}
