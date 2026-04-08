import Skeleton from '@/components/ui/Skeleton'

export default function CheckinsLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <Skeleton width={160} height={26} borderRadius={4} style={{ marginBottom: 24 }} />
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '20px', marginBottom: 16 }}>
        <Skeleton width={100} height={14} borderRadius={4} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={120} borderRadius={8} />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={140} height={16} borderRadius={4} />
            <Skeleton width={40} height={32} borderRadius={8} />
          </div>
        </div>
      ))}
    </div>
  )
}
