// Fire-and-forget Google Sheets sync — call this after any key CRM action.
// Never awaited, never blocks the user, silently skips if not connected.

export function triggerSheetsSync() {
  fetch('/api/google/sync', { method: 'POST' }).catch(() => {
    // Not connected or sync failed — ignore silently
  })
}
