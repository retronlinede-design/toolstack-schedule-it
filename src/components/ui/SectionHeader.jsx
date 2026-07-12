export default function SectionHeader({ title, description, meta, actions }) {
  return <header className="ts-section-header"><div className="min-w-0"><h2 className="ts-section-title">{title}</h2>{description ? <p className="ts-section-description">{description}</p> : null}</div>{meta || actions ? <div className="flex shrink-0 items-center gap-2">{meta}{actions}</div> : null}</header>;
}
