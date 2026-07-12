export default function Card({ variant = "standard", className = "", children, ...props }) {
  const variantClass = variant === "standard" ? "" : `ts-card--${variant}`;
  return <section className={`ts-card ${variantClass} ${className}`} {...props}>{children}</section>;
}
