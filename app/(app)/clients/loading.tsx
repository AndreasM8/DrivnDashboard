import Skeleton from '@/components/ui/Skeleton'

export default function ClientsLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <Skeleton width={80} height={26} borderRadius={4} />
        <Skeleton width={110} height={34} borderRadius={6} />
      </div>
      <Skeleton width="100%" height={38} borderRadius={8} style={{ marginBottom: 16 }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Skeleton width={40} height={40} borderRadius="50%" />
          <div style={{ flex: 1 }}>
            <Skeleton width={140} height={15} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width={100} height={12} borderRadius={4} />
          </div>
          <Skeleton width={80} height={24} borderRadius={20} />
        </div>
      ))}
    </div>
  )
}
