export default function EmptyState({ title, description, action }) {
  return <div className="ts-empty"><p className="font-semibold text-neutral-800">{title}</p>{description ? <p className="mt-1 text-sm">{description}</p> : null}{action ? <div className="mt-3 flex justify-center">{action}</div> : null}</div>;
}
