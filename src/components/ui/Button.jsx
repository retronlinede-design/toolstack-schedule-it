export function Button({ variant = "secondary", loading = false, className = "", children, disabled, type = "button", ...props }) {
  return <button type={type} disabled={disabled || loading} className={`ts-button ts-button--${variant} ${className}`} {...props}>{loading ? "Working…" : children}</button>;
}

export function IconButton({ label, className = "", children, ...props }) {
  return <Button aria-label={label} title={label} className={`ts-icon-button ${className}`} {...props}>{children}</Button>;
}
