import Skeleton from '@/components/ui/Skeleton'

export default function PipelineLoading() {
  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <Skeleton width={80} height={22} borderRadius={4} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton width={90} height={32} borderRadius={6} />
          <Skeleton width={90} height={32} borderRadius={6} />
        </div>
      </div>
      {/* Funnel strip */}
      <div style={{ margin: '16px 24px 8px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={60} style={{ flex: 1 }} borderRadius={8} />
          ))}
        </div>
      </div>
      {/* Kanban columns */}
      <div style={{ display: 'flex', gap: 12, padding: '8px 24px', overflowX: 'auto' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ minWidth: 220, flex: 1, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 12 }}>
            <Skeleton width={100} height={16} borderRadius={4} style={{ marginBottom: 12 }} />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} width="100%" height={72} borderRadius={8} style={{ marginBottom: 8 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
