import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { inviteCodes } from '../lib/inviteCodes'
import { format } from 'date-fns'

export default function Admin({ onBack }) {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [customCode, setCustomCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const loadCodes = async () => {
    setLoading(true)
    const all = await inviteCodes.getAll()
    setCodes(all)
    setLoading(false)
  }

  useEffect(() => { loadCodes() }, [])

  const handleCreate = async () => {
    setCreating(true)
    const entry = await inviteCodes.create(customCode.trim() || null)
    setCodes(prev => [entry, ...prev])
    setCustomCode('')
    setCreating(false)
    showToast(`Code created: ${entry.code}`)
  }

  const handleDelete = async (id, code) => {
    await inviteCodes.delete(id)
    setCodes(prev => prev.filter(c => c.id !== id))
    showToast(`Deleted ${code}`)
  }

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code).catch(() => {})
    showToast(`Copied ${code}`)
  }

  const available = codes.filter(c => !c.used).length
  const used = codes.filter(c => c.used).length

  return (
    <div className="min-h-screen bg-[#030712] px-4 py-8 max-w-lg mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-brand-500 text-white text-sm font-bold px-6 py-3 rounded-full whitespace-nowrap"
            style={{ boxShadow: '0 4px 24px rgba(34,197,94,0.5)' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Admin Panel</h1>
          <p className="text-xs text-gray-600 mt-0.5">GrindMetric · Invite Codes</p>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)', color: '#000' }}>
          Access App →
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total', value: codes.length, color: '#9ca3af' },
          { label: 'Available', value: available, color: '#4ade80' },
          { label: 'Used', value: used, color: '#f97316' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Create Code */}
      <div className="card p-4 mb-6">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Create Invite Code</p>
        <div className="flex gap-2 mb-2">
          <input
            value={customCode}
            onChange={e => setCustomCode(e.target.value.toUpperCase())}
            placeholder="Custom code (optional)"
            maxLength={20}
            className="input-field flex-1 h-10 text-sm font-mono tracking-widest uppercase"
          />
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleCreate} disabled={creating}
            className="btn-primary px-4 h-10 text-sm whitespace-nowrap disabled:opacity-50">
            {creating ? '...' : '+ Create'}
          </motion.button>
        </div>
        <p className="text-[10px] text-gray-600">Leave blank to auto-generate a random code (e.g. WXYZ-AB12)</p>
      </div>

      {/* Codes List */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          All Codes {loading && <span className="text-gray-700">(loading...)</span>}
        </p>
        {codes.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-700 text-sm">No codes yet. Create one above.</div>
        )}
        <div className="space-y-2 pb-12">
          <AnimatePresence>
            {codes.map(c => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                className="card p-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.used ? '#f97316' : '#4ade80' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-white text-sm tracking-widest">{c.code}</p>
                  {c.used ? (
                    <p className="text-[10px] text-orange-400 mt-0.5">
                      Used by {c.used_by || 'unknown'} · {c.used_at ? format(new Date(c.used_at), 'MMM d, yyyy') : ''}
                    </p>
                  ) : (
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      Created {format(new Date(c.created_at), 'MMM d, yyyy')} · Available
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {!c.used && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCopy(c.code)}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-bold text-brand-400"
                      style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      Copy
                    </motion.button>
                  )}
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(c.id, c.code)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-bold text-red-400"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    Delete
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
