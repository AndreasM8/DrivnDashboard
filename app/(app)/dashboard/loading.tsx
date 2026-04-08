import Skeleton from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <Skeleton width={200} height={28} borderRadius={6} />
        <Skeleton width={120} height={28} borderRadius={20} />
      </div>
      {/* 4 stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 24 }} className="md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderLeft: '3px solid var(--border-strong)', borderRadius: 'var(--radius-card)', padding: '14px' }}>
            <Skeleton width={80} height={10} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={28} borderRadius={6} />
          </div>
        ))}
      </div>
      {/* 2 section cards */}
      <div style={{ display: 'grid', gap: 16, marginBottom: 16 }} className="lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20 }}>
            <Skeleton width={140} height={18} borderRadius={4} style={{ marginBottom: 16 }} />
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} width="100%" height={36} borderRadius={6} style={{ marginBottom: 8 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
