import Skeleton from '@/components/ui/Skeleton'

export default function NumbersLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Skeleton width={100} height={26} borderRadius={4} />
        <Skeleton width={130} height={32} borderRadius={6} />
      </div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }} className="md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
            <Skeleton width={80} height={10} borderRadius={4} style={{ marginBottom: 10 }} />
            <Skeleton width={90} height={32} borderRadius={6} style={{ marginBottom: 6 }} />
            <Skeleton width={60} height={10} borderRadius={4} />
          </div>
        ))}
      </div>
      {/* Chart placeholder */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '20px', marginBottom: 16 }}>
        <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={180} borderRadius={8} />
      </div>
    </div>
  )
}
