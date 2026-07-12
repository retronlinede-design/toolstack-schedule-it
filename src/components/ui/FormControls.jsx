export function Input({ className = "", invalid = false, ...props }) { return <input className={`ts-control ${className}`} aria-invalid={invalid || undefined} {...props} />; }
export function Select({ className = "", invalid = false, ...props }) { return <select className={`ts-control ${className}`} aria-invalid={invalid || undefined} {...props} />; }
export function Textarea({ className = "", invalid = false, ...props }) { return <textarea className={`ts-control ${className}`} aria-invalid={invalid || undefined} {...props} />; }
export function Checkbox({ className = "", ...props }) { return <input type="checkbox" className={`ts-checkbox ${className}`} {...props} />; }
