import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

export default function DisclosureSection({ title, summary, defaultOpen = false, forceOpen = false, className = "", children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const expanded = forceOpen || open;
  return <section className={`rounded-[14px] border border-[var(--ts-border)] bg-[var(--ts-surface-muted)] ${className}`}><button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setOpen((value) => !value)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-left hover:bg-[var(--ts-accent-hover)]"><span><strong className="block text-sm">{title}</strong>{summary ? <span className="mt-0.5 block text-xs text-[var(--ts-text-muted)]">{summary}</span> : null}</span><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>{expanded ? <div id={id} className="border-t border-[var(--ts-border)] p-4">{children}</div> : null}</section>;
}
