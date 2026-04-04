'use client'

import { useState } from 'react'

export interface Product {
  id: string
  user_id: string
  name: string
  description: string
  price: number
  duration_months: number | null
  active: boolean
  created_at: string
}

interface Props {
  initialProducts: Product[]
  baseCurrency: string
}

interface FormState {
  name: string
  description: string
  price: string
  duration_months: string
}

const EMPTY_FORM: FormState = { name: '', description: '', price: '', duration_months: '' }

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export default function ProductsPanel({ initialProducts, baseCurrency }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(product: Product) {
    setEditingId(product.id)
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      duration_months: product.duration_months != null ? String(product.duration_months) : '',
    })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      duration_months: form.duration_months !== '' ? Number(form.duration_months) : null,
    }

    if (editingId) {
      const res = await fetch(`/api/products/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json() as { product: Product }
      if (json.product) {
        setProducts(ps => ps.map(p => p.id === editingId ? json.product : p))
      }
    } else {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json() as { product: Product }
      if (json.product) {
        setProducts(ps => [...ps, json.product])
      }
    }

    setSaving(false)
    closeForm()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setProducts(ps => ps.filter(p => p.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7C3AED' }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)' }}>Products</span>
          <span style={{
            fontSize: '10px',
            fontWeight: '500',
            color: '#7C3AED',
            background: 'rgba(124,58,237,0.1)',
            padding: '1px 6px',
            borderRadius: '999px',
          }}>{products.length}</span>
        </div>
        <button
          onClick={openNew}
          style={{
            fontSize: '11px',
            fontWeight: '600',
            padding: '4px 10px',
            borderRadius: 'var(--radius-btn)',
            background: '#7C3AED',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            transition: 'opacity 120ms ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          + New product
        </button>
      </div>

      {/* Inline form */}
      {formOpen && (
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(124,58,237,0.04)',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: '#7C3AED', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {editingId ? 'Edit product' : 'New product'}
          </p>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Name *
              </label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 12-Week 1:1 Coaching"
                className="input-base"
                style={{ fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Tagline (optional)
              </label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short description…"
                className="input-base"
                style={{ fontSize: '12px' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                  Price ({baseCurrency}) *
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0"
                  className="input-base"
                  style={{ fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                  Duration (months)
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.duration_months}
                  onChange={e => setForm(f => ({ ...f, duration_months: e.target.value }))}
                  placeholder="Leave blank = PIF"
                  className="input-base"
                  style={{ fontSize: '12px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={closeForm}
                className="btn-ghost"
                style={{ flex: 1, fontSize: '12px', padding: '7px 0' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1,
                  fontSize: '12px',
                  padding: '7px 0',
                  borderRadius: 'var(--radius-btn)',
                  background: '#7C3AED',
                  color: '#fff',
                  border: 'none',
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: '600',
                  opacity: saving ? 0.7 : 1,
                  transition: 'opacity 120ms ease',
                }}
              >
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {products.length === 0 && !formOpen ? (
          <div style={{ textAlign: 'center', padding: '60px 16px' }}>
            <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-2)', marginBottom: '4px' }}>No products yet</p>
            <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>Create your first offer</p>
          </div>
        ) : (
          products.map(product => (
            <div
              key={product.id}
              onMouseEnter={() => setHoveredId(product.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid #7C3AED',
                borderRadius: 'var(--radius-card)',
                padding: '10px 12px',
                position: 'relative',
                boxShadow: 'var(--shadow-card)',
                transition: 'box-shadow 120ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {product.name}
                  </p>
                  {product.description && (
                    <p style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                      {product.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#7C3AED' }}>
                      {formatCurrency(product.price, baseCurrency)}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: product.duration_months != null ? 'rgba(124,58,237,0.1)' : 'rgba(22,163,74,0.1)',
                      color: product.duration_months != null ? '#7C3AED' : 'var(--success)',
                      fontWeight: '500',
                    }}>
                      {product.duration_months != null ? `${product.duration_months} mo` : 'One-time'}
                    </span>
                  </div>
                </div>

                {/* Actions — visible on hover */}
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  opacity: hoveredId === product.id ? 1 : 0,
                  transition: 'opacity 120ms ease',
                  flexShrink: 0,
                }}>
                  {/* Edit */}
                  <button
                    onClick={() => openEdit(product)}
                    title="Edit"
                    style={{
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-btn)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      color: 'var(--text-2)',
                      transition: 'all 120ms ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(124,58,237,0.1)'
                      e.currentTarget.style.color = '#7C3AED'
                      e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--surface-2)'
                      e.currentTarget.style.color = 'var(--text-2)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(product.id)}
                    title="Delete"
                    style={{
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-btn)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      color: 'var(--text-3)',
                      transition: 'all 120ms ease',
                      fontSize: '16px',
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(220,38,38,0.1)'
                      e.currentTarget.style.color = 'var(--danger)'
                      e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--surface-2)'
                      e.currentTarget.style.color = 'var(--text-3)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
