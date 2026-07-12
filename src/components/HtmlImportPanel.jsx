import { ArrowLeft, Check, ClipboardPaste } from "lucide-react";
import { useState } from "react";
import { parseScheduleHtml } from "../utils/importHtml";
import AlertBanner from "./ui/AlertBanner";
import { Button } from "./ui/Button";
import { Select, Textarea } from "./ui/FormControls";

function AlertList({ title, items, tone }) {
  if (!items.length) return null;

  const styles = tone === "error" ? "border-red-100 bg-red-50 text-red-700" : "border-amber-100 bg-amber-50 text-amber-700";
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function HtmlImportPanel({ onBack, onApply }) {
  const [rawHtml, setRawHtml] = useState("");
  const [parseResult, setParseResult] = useState(null);
  const [mode, setMode] = useState("appendNewDay");
  const [message, setMessage] = useState("");

  function handleParse() {
    const result = parseScheduleHtml(rawHtml);
    setParseResult(result);
    setMessage(result.errors.length ? "Parsing failed. Review the errors below." : "HTML parsed. Review before applying.");
  }

  function handleApply() {
    if (!parseResult || parseResult.errors.length > 0) return;
    const result = onApply(parseResult, mode);
    setMessage(result);
  }

  return (
    <div className="min-w-0 max-w-full">
      <div className="mb-5 flex min-w-0 items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Import from HTML</h2>
          <p className="text-sm text-neutral-500">Paste an exported ScheduleIt table or compatible schedule HTML.</p>
          <p className="mt-1 text-xs font-semibold text-amber-700">HTML import is not a full backup restore.</p>
        </div>
        <Button onClick={onBack} variant="secondary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {message ? <AlertBanner tone="info" className="mb-4">{message}</AlertBanner> : null}

      <div className="grid gap-4">
        <Textarea
          value={rawHtml}
          onChange={(event) => setRawHtml(event.target.value)}
          className="min-h-48 min-w-0 w-full max-w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 font-mono text-xs text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          placeholder="Paste raw HTML here..."
        />

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleParse} variant="secondary">
            <ClipboardPaste className="h-4 w-4" /> Parse Preview
          </Button>
          <Select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          >
            <option value="appendNewDay">Append to new schedule day</option>
            <option value="replace">Replace current schedule</option>
          </Select>
          <Button
            onClick={handleApply}
            disabled={!parseResult || parseResult.errors.length > 0}
            variant={mode === "replace" ? "danger-strong" : "primary"}
          >
            <Check className="h-4 w-4" /> {mode === "replace" ? "Replace Current Schedule" : "Append Imported Day"}
          </Button>
        </div>

        {parseResult ? (
          <div className="space-y-4">
            <AlertList title="Errors" items={parseResult.errors} tone="error" />
            <AlertList title="Warnings" items={parseResult.warnings} tone="warning" />

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <p className="font-semibold text-neutral-900">Schedule day preview</p>
              <p className="mt-1 text-neutral-600">
                {parseResult.scheduleDayDraft.date || "No date"} - {parseResult.scheduleDayDraft.title || "Imported HTML Schedule"}
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                Movements: {parseResult.movements.length} | New drivers: {parseResult.driversToAdd.length} | New vehicles: {parseResult.vehiclesToAdd.length}
              </p>
            </div>

            {parseResult.movements.length > 0 ? (
              <div className="min-w-0 max-w-full overflow-x-auto">
                <table className="min-w-[900px] w-full border-collapse border border-neutral-200 bg-white text-xs">
                  <thead className="bg-neutral-50 text-[10px] uppercase text-neutral-500">
                    <tr>
                      <th className="border border-neutral-200 p-2 text-left">Time</th>
                      <th className="border border-neutral-200 p-2 text-left">Engagement</th>
                      <th className="border border-neutral-200 p-2 text-left">Venue</th>
                      <th className="border border-neutral-200 p-2 text-left">Driver</th>
                      <th className="border border-neutral-200 p-2 text-left">Vehicle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.movements.map((movement) => (
                      <tr key={movement.sortOrder}>
                        <td className="border border-neutral-200 p-2 font-semibold">
                          {movement.driverStart || movement.departureTime || movement.arrivalTime || movement.endTime || "-"}
                        </td>
                        <td className="border border-neutral-200 p-2">{movement.engagementDetails || "-"}</td>
                        <td className="border border-neutral-200 p-2">{movement.venue || "-"}</td>
                        <td className="border border-neutral-200 p-2">{movement.driverName || "-"}</td>
                        <td className="border border-neutral-200 p-2">{movement.vehicleName || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
