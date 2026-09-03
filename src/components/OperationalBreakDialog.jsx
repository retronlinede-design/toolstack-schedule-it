import { useState } from "react";
import { validateOperationalBreakInput } from "../domain/operationalBreaks";
import { Button } from "./ui/Button";
import { Input } from "./ui/FormControls";
import ModalShell from "./ui/ModalShell";

const initialValues = {
  eventStartTime: "",
  eventEndTime: "",
  engagementDetails: "",
  venue: "",
  address: "",
};
const editableFields = new Set(Object.keys(initialValues));

function Field({ label, error, children }) {
  return (
    <label className="ts-label">
      <span className="ts-label-text">{label}</span>
      {children}
      {error ? <span className="ts-field-error">{error}</span> : null}
    </label>
  );
}

export default function OperationalBreakDialog({ context, day, driver, vehicle, schedule, onSave, onClose }) {
  const [values, setValues] = useState(initialValues);
  const [issues, setIssues] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const errors = Object.fromEntries(issues.filter((issue) => issue.field).map((issue) => [issue.field, issue.message]));
  const generalIssues = issues.filter((issue) => !issue.field || !editableFields.has(issue.field));

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setIssues((current) => current.filter((issue) => issue.field !== field));
  }

  function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const input = { ...values, ...context };
    const nextIssues = validateOperationalBreakInput(input, schedule);
    if (nextIssues.length > 0) {
      setIssues(nextIssues);
      return;
    }
    setSubmitting(true);
    const result = onSave(input);
    if (result?.ok === false) {
      setIssues(result.issues?.length ? result.issues : [{ message: "The break could not be added." }]);
      setSubmitting(false);
      return;
    }
    onClose();
  }

  return (
    <ModalShell title="Add Break" subtitle={`${day?.date || "Schedule day"}${day?.title ? ` · ${day.title}` : ""}`} onClose={onClose} maxWidth="max-w-xl">
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Break start" error={errors.eventStartTime}>
            <Input autoFocus required type="time" value={values.eventStartTime} invalid={Boolean(errors.eventStartTime)} onChange={(event) => update("eventStartTime", event.target.value)} />
          </Field>
          <Field label="Break end" error={errors.eventEndTime}>
            <Input required type="time" value={values.eventEndTime} invalid={Boolean(errors.eventEndTime)} onChange={(event) => update("eventEndTime", event.target.value)} />
          </Field>
        </div>
        <Field label="Description / title" error={errors.engagementDetails}>
          <Input required value={values.engagementDetails} invalid={Boolean(errors.engagementDetails)} onChange={(event) => update("engagementDetails", event.target.value)} placeholder="Lunch" />
        </Field>
        <Field label="Location / venue" error={errors.venue}>
          <Input required value={values.venue} invalid={Boolean(errors.venue)} onChange={(event) => update("venue", event.target.value)} placeholder="Restaurant" />
        </Field>
        <Field label="Address (optional)">
          <Input value={values.address} onChange={(event) => update("address", event.target.value)} />
        </Field>
        <dl className="grid gap-3 rounded-xl bg-neutral-50 p-3 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold text-neutral-500">Driver</dt><dd className="mt-1 font-bold text-neutral-900">{driver?.name || "Unavailable"}</dd></div>
          <div><dt className="font-semibold text-neutral-500">Vehicle</dt><dd className="mt-1 font-bold text-neutral-900">{vehicle?.name || "Unavailable"}</dd></div>
        </dl>
        {generalIssues.length ? (
          <div className="ts-alert ts-alert--danger" role="alert">
            <ul className="list-disc pl-5 text-sm">{generalIssues.map((issue, index) => <li key={`${issue.type || "break"}-${index}`}>{issue.message}</li>)}</ul>
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="primary" loading={submitting}>Add Break</Button>
        </div>
      </form>
    </ModalShell>
  );
}
