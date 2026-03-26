import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../contexts/AppContext'
import { getCoachingFeedback, getWeeklySummary } from '../lib/gemini'
import { calculateNutritionGoals } from '../lib/nutrition'
import { format } from 'date-fns'

// Animated number that counts up
function CountUp({ value, duration = 600 }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef()
  useEffect(() => {
    const start = Date.now()
    const from = display
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return <>{display}</>
}

// SVG Calorie Ring
function CalorieRing({ calories, goal }) {
  const pct = Math.min(1, calories / goal)
  const R = 70
  const circ = 2 * Math.PI * R
  const dash = pct * circ
  const over = calories > goal

  return (
    <div className="relative flex items-center justify-center" style={{ width: 168, height: 168 }}>
      <svg width="168" height="168" viewBox="0 0 168 168" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="84" cy="84" r={R} fill="none" stroke="#1a1f2e" strokeWidth="10" />
        {/* Progress */}
        <motion.circle
          cx="84" cy="84" r={R}
          fill="none"
          stroke={over ? '#ef4444' : 'url(#ringGrad)'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-black text-white leading-none">
          <CountUp value={calories} />
        </p>
        <p className="text-[10px] text-gray-500 font-semibold mt-0.5">of {goal} cal</p>
        <p className={`text-xs font-bold mt-1 ${over ? 'text-red-400' : 'text-brand-400'}`}>
          {over ? `+${calories - goal}` : `${goal - calories} left`}
        </p>
      </div>
    </div>
  )
}

function MacroBar({ label, value, goal, color, delay = 0 }) {
  const pct = Math.min(100, (value / goal) * 100)
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs font-semibold text-gray-400">{label}</span>
        <span className="text-xs font-bold text-white">{value}<span className="text-gray-600 font-normal">/{goal}g</span></span>
      </div>
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

export default function Dashboard({ onNavigate }) {
  const { todayWorkouts, todayFoods, todayNutrition, streak, workouts, weightLogs, foods, user } = useApp()
  const AI_FEEDBACK_KEY = 'gm_ai_coach_feedback'
  const AI_COOLDOWN_KEY = 'gm_ai_coach_cooldown_until'
  const [aiText, setAiTextState] = useState(() => localStorage.getItem(AI_FEEDBACK_KEY) || null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiOpen, setAiOpen] = useState(() => !!localStorage.getItem(AI_FEEDBACK_KEY))
  const [aiCooldown, setAiCooldown] = useState(0)
  const aiCooldownRef = useRef(null)

  const setAiText = (text) => {
    setAiTextState(text)
    if (text) localStorage.setItem(AI_FEEDBACK_KEY, text)
    else localStorage.removeItem(AI_FEEDBACK_KEY)
  }
  const [weeklyText, setWeeklyText] = useState(null)
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [weeklyOpen, setWeeklyOpen] = useState(false)

  const today = format(new Date(), "EEEE, MMM d")
  const { calories, protein, carbs, fat } = todayNutrition
  const goals = user?.profile?.nutritionGoals || calculateNutritionGoals(user?.profile)
  const CALORIE_GOAL = goals.calories
  const PROTEIN_GOAL = goals.protein
  const CARBS_GOAL   = goals.carbs
  const FAT_GOAL     = goals.fat
  const weightTrend = weightLogs.slice(0, 7).map(w => `${w.log_date}: ${w.weight_kg}kg`).join(', ') || 'No data'

  const startCooldown = (seconds) => {
    const until = Date.now() + seconds * 1000
    localStorage.setItem(AI_COOLDOWN_KEY, String(until))
    const tick = () => {
      const remaining = Math.ceil((until - Date.now()) / 1000)
      if (remaining <= 0) { clearInterval(aiCooldownRef.current); setAiCooldown(0); return }
      setAiCooldown(remaining)
    }
    tick()
    clearInterval(aiCooldownRef.current)
    aiCooldownRef.current = setInterval(tick, 1000)
  }

  // Restore cooldown if tab was switched or component remounted
  useEffect(() => {
    const until = parseInt(localStorage.getItem(AI_COOLDOWN_KEY) || '0')
    const remaining = Math.ceil((until - Date.now()) / 1000)
    if (remaining > 0) startCooldown(remaining)
    return () => clearInterval(aiCooldownRef.current)
  }, [])

  const handleAI = async () => {
    if (aiLoading || aiCooldown > 0) return
    setAiText(null)
    setAiLoading(true)
    setAiOpen(true)
    const text = await getCoachingFeedback({ workouts: todayWorkouts, nutrition: todayNutrition, weightTrend, streak, userProfile: user?.profile })
    setAiText(text || 'AI coaching requires a Gemini API key — contact the app admin.')
    setAiLoading(false)
    startCooldown(60)
  }

  const handleWeeklySummary = async () => {
    setWeeklyLoading(true)
    setWeeklyOpen(true)
    const last7workouts = workouts.filter(w => new Date(w.created_at) > new Date(Date.now() - 7 * 86400000))
    const dailyCals = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      return foods.filter(f => f.created_at.startsWith(ds)).reduce((s, f) => s + f.calories, 0)
    }).filter(c => c > 0)
    const text = await getWeeklySummary({ workouts: last7workouts, nutrition: dailyCals, weightLogs: weightLogs.slice(0, 7), streak, userProfile: user?.profile })
    setWeeklyText(text)
    setWeeklyLoading(false)
  }

  // Last 14 days heatmap
  const workoutDays = new Set(workouts.map(w => w.created_at.split('T')[0]))
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 13 + i)
    return d.toISOString().split('T')[0]
  })

  return (
    <div className="tab-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between mb-6"
      >
        <div>
          <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest">{today}</p>
          <h1 className="text-[28px] font-black text-white mt-0.5 tracking-tight">GrindMetric</h1>
        </div>
        <motion.div
          whileTap={{ scale: 0.92 }}
          className="flex flex-col items-center px-4 py-2.5 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(74,222,128,0.08))', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <span className="text-2xl font-black text-brand-400 leading-none">{streak}</span>
          <span className="text-[9px] text-brand-500 font-bold uppercase tracking-wider mt-0.5">🔥 streak</span>
        </motion.div>
      </motion.div>

      {/* Calorie Ring + Macros hero card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card-elevated p-5 mb-4"
        style={{ background: 'linear-gradient(145deg, #141720 0%, #0f1117 100%)' }}
      >
        <div className="flex items-center gap-5">
          <CalorieRing calories={calories} goal={CALORIE_GOAL} />
          <div className="flex-1 space-y-3">
            <MacroBar label="Protein" value={protein} goal={PROTEIN_GOAL} color="bg-blue-500" delay={0.15} />
            <MacroBar label="Carbs"   value={carbs}   goal={CARBS_GOAL}   color="bg-amber-400" delay={0.2} />
            <MacroBar label="Fat"     value={fat}     goal={FAT_GOAL}     color="bg-rose-500" delay={0.25} />
          </div>
        </div>
      </motion.div>

      {/* Streak heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4 mb-4"
      >
        <p className="section-label mb-3">Last 14 Days</p>
        <div className="flex gap-1.5">
          {last14.map((day, i) => (
            <motion.div
              key={day}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.12 + i * 0.025, type: 'spring', stiffness: 300 }}
              className="flex-1 h-8 rounded-lg"
              title={day}
              style={{
                background: workoutDays.has(day)
                  ? 'linear-gradient(to top, #16a34a, #4ade80)'
                  : 'rgba(255,255,255,0.04)',
                boxShadow: workoutDays.has(day) ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
                transformOrigin: 'bottom',
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-3 gap-3 mb-4"
      >
        {[
          { label: 'Log Workout', emoji: '🏋️', tab: 'workout', color: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.2)' },
          { label: 'Log Food',    emoji: '🍽️', tab: 'nutrition', color: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
          { label: 'Progress',   emoji: '📸', tab: 'progress', color: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
        ].map(({ label, emoji, tab, color, border }) => (
          <motion.button
            key={tab}
            whileTap={{ scale: 0.94 }}
            onClick={() => onNavigate(tab)}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl"
            style={{ background: color, border: `1px solid ${border}` }}
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-[11px] font-bold text-gray-300 leading-tight text-center">{label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* AI Coach */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card p-4 mb-4 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f1a14 0%, #0f1117 100%)', border: '1px solid rgba(34,197,94,0.15)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center">
              <span className="text-sm">🤖</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">AI Coach</p>
              <p className="text-[10px] text-brand-500 font-semibold">Gemini</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleAI}
            disabled={aiLoading || aiCooldown > 0}
            className="btn-primary text-xs px-4 py-2 disabled:opacity-50"
          >
            {aiLoading ? (
              <span className="flex items-center gap-1.5">
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="inline-block">⚡</motion.span>
                Analyzing...
              </span>
            ) : aiCooldown > 0 ? `${aiCooldown}s`
            : aiText ? 'Refresh' : 'Get Feedback'}
          </motion.button>
        </div>
        <AnimatePresence>
          {aiOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {aiLoading ? (
                <div className="flex gap-1 items-center py-2">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-1.5 h-1.5 bg-brand-500 rounded-full"
                      animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                  ))}
                  <span className="text-xs text-gray-500 ml-2">Reading your data...</span>
                </div>
              ) : (
                <p className="text-sm text-gray-300 leading-relaxed pt-1">{aiText}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {!aiOpen && <p className="text-xs text-gray-600">Tap for honest feedback on today's session.</p>}
      </motion.div>

      {/* Weekly Summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="card p-4 mb-4 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d1a26 0%, #0f1117 100%)', border: '1px solid rgba(59,130,246,0.18)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <span className="text-sm">📊</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Weekly Review</p>
              <p className="text-[10px] text-blue-400 font-semibold">Last 7 days</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.94 }} onClick={handleWeeklySummary} disabled={weeklyLoading}
            className="text-xs font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
            {weeklyLoading ? (
              <span className="flex items-center gap-1.5">
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="inline-block">⚡</motion.span>
                Loading...
              </span>
            ) : 'Summarize'}
          </motion.button>
        </div>
        <AnimatePresence>
          {weeklyOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
              {weeklyLoading ? (
                <div className="flex gap-1 items-center py-2">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                      animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                  ))}
                  <span className="text-xs text-gray-500 ml-2">Analyzing your week...</span>
                </div>
              ) : (
                <p className="text-sm text-gray-300 leading-relaxed pt-1">{weeklyText}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {!weeklyOpen && <p className="text-xs text-gray-600">Your performance summary for this week.</p>}
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card p-4"
      >
        <p className="section-label">Today's Activity</p>
        {todayWorkouts.length === 0 && todayFoods.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-5">Nothing logged yet. Get after it.</p>
        ) : (
          <div className="space-y-2.5">
            {todayWorkouts.slice(0, 3).map(w => (
              <div key={w.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl bg-brand-500/15 flex items-center justify-center text-sm shrink-0">💪</div>
                <span className="text-sm font-semibold text-gray-200 flex-1">{w.exercise}</span>
                <span className="text-xs text-gray-500">{w.weight}lbs ×{w.reps}×{w.sets}</span>
              </div>
            ))}
            {todayFoods.slice(0, 3).map(f => (
              <div key={f.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl bg-amber-500/15 flex items-center justify-center text-sm shrink-0">🍽️</div>
                <span className="text-sm font-semibold text-gray-200 flex-1 truncate">{f.food_name}</span>
                <span className="text-xs text-gray-500">{f.calories} cal</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
