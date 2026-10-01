interface Props {
  title: string
  phase: string
  children: React.ReactNode
}

export default function Planned({ title, phase, children }: Props): React.JSX.Element {
  return (
    <div className="empty">
      <span className="badge">{phase}</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  )
}
