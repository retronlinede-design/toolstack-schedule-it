export default function AlertBanner({ tone = "info", title, children, className = "", ...props }) {
  return <div className={`ts-alert ts-alert--${tone} ${className}`} role={tone === "danger" ? "alert" : "status"} {...props}>{title ? <strong className="block">{title}</strong> : null}{children}</div>;
}
