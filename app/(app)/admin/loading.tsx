import Skeleton from '@/components/ui/Skeleton'

export default function AdminLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Skeleton width={80} height={26} borderRadius={4} />
        <Skeleton width={160} height={34} borderRadius={6} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
            <Skeleton width={80} height={10} borderRadius={4} style={{ marginBottom: 10 }} />
            <Skeleton width={60} height={28} borderRadius={6} />
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <Skeleton width={120} height={15} borderRadius={4} />
            <Skeleton width={40} height={15} borderRadius={4} />
            <Skeleton width={50} height={22} borderRadius={4} />
            <Skeleton width={50} height={22} borderRadius={4} />
            <Skeleton width={50} height={22} borderRadius={4} />
            <Skeleton width={80} height={15} borderRadius={4} />
          </div>
        ))}
      </div>
    </div>
  )
}
