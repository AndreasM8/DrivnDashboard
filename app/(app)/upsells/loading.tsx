import Skeleton from '@/components/ui/Skeleton'

export default function UpsellsLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <Skeleton width={80} height={26} borderRadius={4} style={{ marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }} className="md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
            <Skeleton width={70} height={10} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width={40} height={28} borderRadius={6} />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px', marginBottom: 8 }}>
          <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 12 }} />
          {Array.from({ length: 2 }).map((_, j) => (
            <Skeleton key={j} width="100%" height={56} borderRadius={8} style={{ marginBottom: 8 }} />
          ))}
        </div>
      ))}
    </div>
  )
}
