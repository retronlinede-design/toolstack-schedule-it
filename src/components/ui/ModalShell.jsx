import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { IconButton } from "./Button";

export default function ModalShell({ title, subtitle, onClose, maxWidth = "max-w-5xl", children, bodyClassName = "", closeOnBackdrop = false }) {
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = () => [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    (focusable()[0] || panel).focus();
    function keyDown(event) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); panel.focus(); return; }
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    panel.addEventListener("keydown", keyDown);
    return () => { panel.removeEventListener("keydown", keyDown); openerRef.current?.focus?.(); };
  }, []);
  return <div className="ts-modal-backdrop no-print" role="presentation" onMouseDown={(event) => { if (closeOnBackdrop && event.target === event.currentTarget) onClose(); }}><section ref={panelRef} tabIndex={-1} className={`ts-modal ${maxWidth}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}><header className="ts-modal-header"><div className="min-w-0"><h2 id={titleId} className="ts-section-title">{title}</h2>{subtitle ? <p className="ts-section-description">{subtitle}</p> : null}</div><IconButton label="Close" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></IconButton></header><div className={`ts-modal-body ${bodyClassName}`}>{children}</div></section></div>;
}
