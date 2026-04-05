import ExitViewAsButton from './ExitViewAsButton'

interface Props {
  coachName: string
}

export default function ViewAsBanner({ coachName }: Props) {
  return (
    <div
      style={{
        background: '#7C3AED',
        color: '#fff',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        fontWeight: 500,
        flexShrink: 0,
        zIndex: 60,
      }}
    >
      <span>👁 Viewing as <strong>{coachName}</strong> — read only</span>
      <ExitViewAsButton />
    </div>
  )
}
