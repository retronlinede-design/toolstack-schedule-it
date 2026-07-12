import { X } from "lucide-react";
import { IconButton } from "./Button";

export default function ModalShell({ title, subtitle, onClose, maxWidth = "max-w-5xl", children, bodyClassName = "" }) {
  return <div className="ts-modal-backdrop no-print" role="presentation"><section className={`ts-modal ${maxWidth}`} role="dialog" aria-modal="true" aria-label={title}><header className="ts-modal-header"><div className="min-w-0"><h2 className="ts-section-title">{title}</h2>{subtitle ? <p className="ts-section-description">{subtitle}</p> : null}</div><IconButton label="Close" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></IconButton></header><div className={`ts-modal-body ${bodyClassName}`}>{children}</div></section></div>;
}
