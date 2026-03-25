import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../contexts/AppContext'
import { localStore } from '../lib/localStore'

const GOAL_LABELS = { lose_fat: 'Lose Fat 🔥', build_muscle: 'Build Muscle 💪', get_stronger: 'Get Stronger ⚡', endurance: 'Endurance 🏃', maintain: 'Maintain ⚖️' }

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''

export default function Settings({ onLogout, onOpenAdmin }) {
  const { theme, setTheme, workouts, foods, weightLogs, user } = useApp()
  const [toast, setToast] = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000) }

  const exportData = () => {
    const { workouts: wCSV, foods: fCSV, weights: wgCSV } = localStore.exportCSV()
    ;[['grindmetric_workouts.csv', wCSV], ['grindmetric_nutrition.csv', fCSV], ['grindmetric_weights.csv', wgCSV]].forEach(([name, data], i) => {
      setTimeout(() => {
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([data], { type: 'text/csv' })), download: name })
        a.click(); URL.revokeObjectURL(a.href)
      }, i * 200)
    })
    showToast('Exporting CSV files...')
  }

  const stats = [
    { label: 'Workouts',    value: workouts.length,   emoji: '💪', color: '#22c55e' },
    { label: 'Foods',       value: foods.length,      emoji: '🍽️', color: '#f59e0b' },
    { label: 'Weight Logs', value: weightLogs.length, emoji: '⚖️', color: '#3b82f6' },
  ]

  const stackItems = [
    { label: 'Frontend', value: 'React 19 + Vite' },
    { label: 'Styling',  value: 'Tailwind CSS' },
    { label: 'Charts',   value: 'Recharts' },
    { label: 'AI',       value: 'Google Gemini' },
    { label: 'Backend',  value: 'Supabase (ready)' },
    { label: 'Storage',  value: 'Local-first' },
    { label: 'Cost',     value: '$0 / month' },
  ]

  return (
    <div className="tab-page">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-brand-500 text-white text-sm font-bold px-6 py-3 rounded-full"
            style={{ boxShadow: '0 4px 24px rgba(34,197,94,0.5)' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <h2 className="text-[28px] font-black text-white mb-5 tracking-tight">Settings</h2>

      {/* Account card */}
      {user && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/20 flex items-center justify-center text-2xl font-black text-brand-400">
              {user.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <p className="text-base font-black text-white">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          {user.profile?.goal && (
            <div className="flex flex-wrap gap-2 mb-3">
              {user.profile.goal && <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>{GOAL_LABELS[user.profile.goal] || user.profile.goal}</span>}
              {user.profile.daysPerWeek && <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>{user.profile.daysPerWeek}x / week</span>}
              {user.profile.intensity && <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Intensity {user.profile.intensity}/5</span>}
            </div>
          )}
          {user.profile?.workoutPlan && (
            <details className="mb-3">
              <summary className="text-xs font-bold text-brand-400 cursor-pointer">View My Workout Plan ↓</summary>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed whitespace-pre-wrap">{user.profile.workoutPlan}</p>
            </details>
          )}
          {/* Admin button — only for admin account */}
          {(!ADMIN_EMAIL || user?.email === ADMIN_EMAIL) && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={onOpenAdmin}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all mb-2"
              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#c4b5fd' }}>
              🔐 Open Admin Panel
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.97 }} onClick={onLogout}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            Sign Out
          </motion.button>
        </motion.div>
      )}

      {/* Stats row */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3 mb-5">
        {stats.map(({ label, value, emoji, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.07 }}
            className="card p-3.5 text-center">
            <p className="text-xl mb-1">{emoji}</p>
            <p className="text-2xl font-black" style={{ color }}>{value}</p>
            <p className="text-[10px] text-gray-600 font-semibold mt-0.5">{label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Theme toggle */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-4 mb-3">
        <p className="section-label">Appearance</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Theme</p>
            <p className="text-xs text-gray-600">{theme === 'dark' ? 'Dark mode active' : 'Light mode active'}</p>
          </div>
          <div className="flex gap-2">
            {['dark', 'light'].map(t => (
              <motion.button key={t} whileTap={{ scale: 0.93 }} onClick={() => setTheme(t)}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={theme === t
                  ? { background: 'linear-gradient(135deg, #22c55e, #4ade80)', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
                {t === 'dark' ? '🌙' : '☀️'} {t.charAt(0).toUpperCase() + t.slice(1)}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* AI Status */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-4 mb-3">
        <p className="section-label">AI Coaching</p>
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-brand-500" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.8)' }} />
          <p className="text-sm font-semibold text-gray-300">Gemini 2.0 Flash — Active</p>
        </div>
        <p className="text-xs text-gray-600 mt-1.5">AI coaching is personalized to your profile and goal.</p>
      </motion.div>

      {/* Export */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-4 mb-3">
        <p className="section-label">Data & Export</p>
        <motion.button whileTap={{ scale: 0.97 }} onClick={exportData}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold text-white mb-2"
          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <span>📥</span> Export All Data (CSV)
        </motion.button>
        <p className="text-[10px] text-gray-600 text-center">Exports workouts, nutrition, and weight logs</p>
      </motion.div>

      {/* Stack info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-4">
        <p className="section-label">About GrindMetric</p>
        <div className="space-y-2.5">
          {stackItems.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0">
              <span className="text-xs text-gray-600">{label}</span>
              <span className="text-xs font-semibold text-gray-300">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-white/[0.04] text-center">
          <p className="text-xs text-gray-600">GrindMetric v1.0 MVP · Built for the grind 💪</p>
        </div>
      </motion.div>
    </div>
  )
}
