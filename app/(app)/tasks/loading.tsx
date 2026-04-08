import Skeleton from '@/components/ui/Skeleton'

export default function TasksLoading() {
  return (
    <div style={{ padding: '16px 16px 80px' }}>
      {/* Header */}
      <div style={{ padding: '4px 0 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Skeleton width={180} height={22} borderRadius={4} />
          <Skeleton width={80} height={14} borderRadius={4} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width={90} height={24} borderRadius={20} />
          ))}
        </div>
        <Skeleton width={220} height={13} borderRadius={4} />
      </div>
      {/* Section cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <Skeleton width={130} height={16} borderRadius={4} />
            <Skeleton width={60} height={16} borderRadius={4} />
          </div>
          <Skeleton width="100%" height={4} borderRadius={2} style={{ marginBottom: 16 }} />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} width="100%" height={38} borderRadius={8} style={{ marginBottom: 8 }} />
          ))}
        </div>
      ))}
    </div>
  )
}
