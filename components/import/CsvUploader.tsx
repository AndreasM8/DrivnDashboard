'use client'

import { useRef, useState } from 'react'

interface Props {
  onFileLoaded: (csvText: string, fileName: string) => void
  loading?: boolean
}

export default function CsvUploader({ onFileLoaded, loading = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loadedFile, setLoadedFile] = useState<string | null>(null)

  function readFile(file: File) {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      alert('Please upload a .csv file.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const text = (e.target?.result as string | undefined) ?? ''
      if (!text.trim()) {
        alert('The file appears to be empty. Please try exporting it again from Google Sheets.')
        return
      }
      setLoadedFile(file.name)
      onFileLoaded(text, file.name)
    }
    reader.onerror = () => {
      alert('Could not read the file. Please try again.')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  function handleReset() {
    setLoadedFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const borderColor = dragging ? 'var(--neon-indigo)' : 'var(--border-strong)'
  const bgColor = dragging ? 'rgba(99,102,241,0.06)' : 'var(--surface-2)'

  if (loading) {
    return (
      <div style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: 'var(--radius-card)',
        background: bgColor,
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2px solid var(--neon-indigo)',
          borderTopColor: 'transparent',
          animation: 'spin 0.7s linear infinite',
        }} />
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Parsing your CSV with AI…</p>
      </div>
    )
  }

  if (loadedFile) {
    return (
      <div style={{
        border: `2px solid var(--success)`,
        borderRadius: 'var(--radius-card)',
        background: 'rgba(16,185,129,0.05)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(16,185,129,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h8l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
              <path d="M12 4v4h4" />
              <path d="M7 12l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', margin: 0 }}>{loadedFile}</p>
            <p style={{ fontSize: 12, color: 'var(--success)', margin: '2px 0 0' }}>Loaded successfully</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          style={{
            fontSize: 12, color: 'var(--text-3)', background: 'none',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-btn)',
            padding: '5px 12px', cursor: 'pointer', flexShrink: 0,
          }}
        >
          Change file
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: 'var(--radius-card)',
        background: bgColor,
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 150ms ease, background 150ms ease',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: 'rgba(99,102,241,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 20 20" fill="none" width="22" height="22" stroke="var(--neon-indigo)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17a1 1 0 011-1h12a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-1z" />
          <path d="M10 3v10M7 6l3-3 3 3" />
        </svg>
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', margin: 0 }}>
          Drag your CSV file here or click to upload
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
          Accepts .csv files exported from Google Sheets
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}
