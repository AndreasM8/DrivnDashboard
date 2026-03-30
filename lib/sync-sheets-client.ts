// Fire-and-forget Google Sheets sync — call this after any key CRM action.
// Never awaited, never blocks the user.
// Stores last sync status in localStorage so Settings can surface failures.

const SYNC_KEY = 'drivn_sheets_last_sync'

export function triggerSheetsSync() {
  fetch('/api/google/sync', { method: 'POST' })
    .then(async (res) => {
      if (res.ok) {
        localStorage.setItem(SYNC_KEY, JSON.stringify({ ok: true, at: new Date().toISOString() }))
      } else {
        const body = await res.json().catch(() => ({}))
        localStorage.setItem(SYNC_KEY, JSON.stringify({
          ok: false,
          at: new Date().toISOString(),
          error: body?.error ?? `HTTP ${res.status}`,
        }))
      }
    })
    .catch((err) => {
      // Network error or not connected — store quietly, don't alert the user
      localStorage.setItem(SYNC_KEY, JSON.stringify({
        ok: false,
        at: new Date().toISOString(),
        error: err?.message ?? 'Network error',
      }))
    })
}

export function getLastSyncStatus(): { ok: boolean; at: string; error?: string } | null {
  try {
    const raw = localStorage.getItem(SYNC_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
