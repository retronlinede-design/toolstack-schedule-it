export default function SectionHeader({ title, description, meta, actions }) {
  return <header className="ts-section-header flex-wrap"><div className="min-w-0 flex-1"><h2 className="ts-section-title break-words">{title}</h2>{description ? <p className="ts-section-description break-words">{description}</p> : null}</div>{meta || actions ? <div className="flex flex-wrap items-center gap-2">{meta}{actions}</div> : null}</header>;
}
