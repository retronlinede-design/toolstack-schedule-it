import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { defaultScheduleState } from "../data/defaultData";
import { downloadRaw, replaceCorruptWithNew } from "../storage/recovery";
import { APP_KEY } from "../utils/storage";
import Card from "./ui/Card";
import { Button } from "./ui/Button";
import AlertBanner from "./ui/AlertBanner";

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
    <main className="ts-app p-4 sm:p-8">
      <Card className="mx-auto max-w-2xl p-6" role="alert">
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
          <AlertBanner tone={startup.recovery.ok ? "success" : "danger"} className="mt-4">
            {startup.recovery.ok ? `An exact recovery copy was verified at ${startup.recovery.key}.` : "The recovery copy could not be verified. The primary value remains untouched."}
          </AlertBanner>
        ) : null}
        {startup.actionError ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{startup.actionError.message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={onRetry} variant="primary">
            <RefreshCw className="h-4 w-4" /> {migration ? "Retry migration" : "Retry storage"}
          </Button>
          {recovery ? (
            <>
              <Button onClick={() => downloadRaw("schedule-it-corrupt-primary-recovery.txt", startup.raw)}>
                <Download className="h-4 w-4" /> Download raw recovery data
              </Button>
              <Button onClick={startNew} variant="danger">Start with new schedule</Button>
            </>
          ) : null}
          {migration ? (
            <>
              <Button onClick={() => downloadSource("form", startup.sources?.form)} disabled={startup.sources?.form?.status !== "found"}>Download legacy form</Button>
              <Button onClick={() => downloadSource("entries", startup.sources?.entries)} disabled={startup.sources?.entries?.status !== "found"}>Download legacy entries</Button>
              {startup.candidate ? <Button onClick={() => window.confirm("Continue with migrated data in volatile memory? Changes will not be saved.") && onVolatile(startup.candidate)} variant="danger">Use volatile migrated data</Button> : null}
            </>
          ) : null}
        </div>

        <details className="mt-6 rounded-xl bg-neutral-50 p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Technical details</summary>
          <pre className="mt-2 whitespace-pre-wrap">{startup.code || startup.error?.message || startup.actionError?.code || "Storage access failed."}</pre>
        </details>
      </Card>
    </main>
  );
}
