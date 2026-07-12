export default function Badge({ tone = "neutral", children, className = "", ...props }) {
  return <span className={`ts-badge ${tone === "neutral" ? "" : `ts-badge--${tone}`} ${className}`} {...props}>{children}</span>;
}
