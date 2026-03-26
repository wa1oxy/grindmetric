import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../contexts/AppContext'
import { analyzeWorkoutPlan } from '../lib/gemini'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format } from 'date-fns'

function parsePlanLifts(plan) {
  if (!plan) return []
  const match = plan.match(/## KEY LIFTS\n([\s\S]*?)(?=\n##|$)/)
  if (!match) return []
  return match[1].split('\n')
    .map(l => l.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('|').map(s => s.replace(/\*\*/g, '').trim())
      if (!parts[0]) return null
      const setsReps = parts[1] || ''
      const setsMatch = setsReps.match(/(\d+)\s*[x×]\s*([\d\-]+)/)
      return {
        exercise: parts[0],
        setsReps,
        sets: setsMatch ? parseInt(setsMatch[1]) : 3,
        reps: setsMatch ? parseInt(setsMatch[2]) : 10,
        reason: parts[2] || '',
      }
    }).filter(Boolean)
}

function renderBold(text) {
  if (!text) return null
  return text.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="text-white font-bold">{p.slice(2, -2)}</strong>
      : p
  )
}

const PRESETS = [
  { name: 'Bench Press', emoji: '🏋️' },
  { name: 'Squat',       emoji: '🦵' },
  { name: 'Deadlift',    emoji: '⚡' },
  { name: 'Rows',        emoji: '🚣' },
  { name: 'OHP',         emoji: '🙌' },
  { name: 'Curls',       emoji: '💪' },
  { name: 'Pull-ups',    emoji: '🔼' },
  { name: 'Dips',        emoji: '↕️' },
  { name: 'Lunges',      emoji: '🏃' },
  { name: 'RDL',         emoji: '🔩' },
]

function calcOneRM(weight, reps) { return Math.round(weight * (1 + reps / 30)) }

function NumInput({ label, value, onChange, color = 'brand' }) {
  const inc = (v) => onChange(String((parseFloat(v) || 0) + (label === 'Weight' ? 5 : 1)))
  const dec = (v) => onChange(String(Math.max(0, (parseFloat(v) || 0) - (label === 'Weight' ? 5 : 1))))
  return (
    <div className="card p-3 flex flex-col items-center gap-2">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
      <div className="flex items-center gap-2">
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => dec(value)}
          className="w-8 h-8 rounded-xl bg-white/[0.06] text-gray-300 font-bold text-lg flex items-center justify-center">−</motion.button>
        <input
          type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)}
          className="w-14 text-center text-xl font-black text-white bg-transparent outline-none"
          placeholder="0"
        />
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => inc(value)}
          className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 font-bold text-lg flex items-center justify-center">+</motion.button>
      </div>
    </div>
  )
}

export default function Workout() {
  const { workouts, addWorkout, deleteWorkout, user } = useApp()
  const [exercise, setExercise] = useState('')
  const [custom, setCustom] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState('')
  const [chartExercise, setChartExercise] = useState('Bench Press')
  const [toast, setToast] = useState(null)
  const [loggedId, setLoggedId] = useState(null)
  const [showPlanSheet, setShowPlanSheet] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisText, setAnalysisText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [planDismissed, setPlanDismissed] = useState(false)

  const workoutPlan = user?.profile?.workoutPlan
  const planLifts = parsePlanLifts(workoutPlan)
  const showCTA = workoutPlan && !planDismissed && planLifts.length > 0

  const selected = exercise || custom
  const oneRM = weight && reps ? calcOneRM(parseFloat(weight), parseInt(reps)) : null

  const prefillExercise = (lift) => {
    setExercise(lift.exercise)
    setCustom('')
    setSets(String(lift.sets))
    setReps(String(lift.reps))
    setShowPlanSheet(false)
  }

  const handleAnalyze = async () => {
    setShowAnalysis(true)
    if (analysisText) return
    setAnalyzing(true)
    const result = await analyzeWorkoutPlan({
      workoutHistory: workouts,
      workoutPlan,
      dreamPhotoBase64: user?.profile?.dreamPhoto ? user.profile.dreamPhoto.split(',')[1] : null,
      userProfile: user?.profile,
    })
    setAnalysisText(result || 'Could not analyze. Try again.')
    setAnalyzing(false)
  }

  const handleLog = () => {
    if (!selected || !weight || !reps || !sets) return
    const entry = addWorkout({ exercise: selected, weight: parseFloat(weight), reps: parseInt(reps), sets: parseInt(sets) })
    setLoggedId(entry.id)
    setTimeout(() => setLoggedId(null), 1200)
    setWeight(''); setReps(''); setSets(''); setCustom(''); setExercise('')
    showToast('Logged! 💪')
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  // PR detection
  const prs = {}
  for (const w of workouts) {
    if (!prs[w.exercise] || w.weight > prs[w.exercise]) prs[w.exercise] = w.weight
  }
  const isNewPR = selected && weight && prs[selected] && parseFloat(weight) > prs[selected]

  // Chart
  const exercises = [...new Set(workouts.map(w => w.exercise))]
  const chartData = workouts
    .filter(w => w.exercise === chartExercise)
    .map(w => ({ date: format(new Date(w.created_at), 'MM/dd'), weight: w.weight, oneRM: calcOneRM(w.weight, w.reps) }))
    .reverse().slice(-12)

  const recentGroups = groupByDate(workouts.slice(0, 25))

  return (
    <div className="tab-page">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-brand-500 text-white text-sm font-bold px-6 py-3 rounded-full shadow-lg"
            style={{ boxShadow: '0 4px 24px rgba(34,197,94,0.5)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <h2 className="text-[28px] font-black text-white mb-5 tracking-tight">Lift</h2>

      {/* Plan CTA */}
      <AnimatePresence>
        {showCTA && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl p-4 mb-5"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p className="text-xs text-green-400 font-bold uppercase tracking-widest mb-1">Your AI Plan is Ready</p>
            <p className="text-sm text-gray-400 mb-3">Start with your recommended exercises or build your own.</p>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowPlanSheet(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black"
                style={{ background: 'linear-gradient(135deg,#22c55e,#4ade80)' }}>
                📋 Use Recommended
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setPlanDismissed(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-400"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ✏️ Own Routine
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise selector */}
      <p className="section-label">Exercise</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map((e, i) => (
          <motion.button
            key={e.name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => { setExercise(e.name); setCustom('') }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              exercise === e.name
                ? 'text-black font-bold'
                : 'bg-white/[0.05] border border-white/[0.08] text-gray-400'
            }`}
            style={exercise === e.name ? {
              background: 'linear-gradient(135deg, #22c55e, #4ade80)',
              boxShadow: '0 4px 16px rgba(34,197,94,0.35)'
            } : {}}
          >
            <span>{e.emoji}</span> {e.name}
          </motion.button>
        ))}
      </div>
      <input
        value={custom}
        onChange={e => { setCustom(e.target.value); setExercise('') }}
        placeholder="+ Custom exercise"
        className="input-field w-full h-11 mb-5 text-sm"
      />

      {/* Inputs */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <NumInput label="Weight" value={weight} onChange={setWeight} />
        <NumInput label="Reps"   value={reps}   onChange={setReps} />
        <NumInput label="Sets"   value={sets}   onChange={setSets} />
      </div>

      {/* 1RM + PR badge */}
      <div className="flex items-center justify-center gap-3 mb-4 h-7">
        <AnimatePresence>
          {oneRM && (
            <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="text-xs text-gray-400">
              Est. 1RM: <span className="text-brand-400 font-bold">{oneRM} lbs</span>
            </motion.span>
          )}
          {isNewPR && (
            <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-xs font-black px-3 py-1 rounded-full"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#000' }}>
              🏆 NEW PR!
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleLog}
        disabled={!selected || !weight || !reps || !sets}
        className="btn-primary w-full py-4 text-base mb-3 disabled:opacity-30 disabled:shadow-none"
      >
        Log Workout
      </motion.button>

      {workoutPlan && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleAnalyze}
          className="w-full py-3 rounded-xl text-sm font-bold mb-6"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}>
          🧠 Analyze My Workout Plan
        </motion.button>
      )}

      {/* Strength Chart */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">Strength Progression</p>
        </div>
        <select
          value={chartExercise}
          onChange={e => setChartExercise(e.target.value)}
          className="input-field w-full h-10 text-sm mb-3"
        >
          {[...new Set([...PRESETS.map(p => p.name), ...exercises])].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#4ade80" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#141720', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff', fontSize: 12 }}
                cursor={{ stroke: 'rgba(34,197,94,0.2)', strokeWidth: 1 }}
              />
              <Line type="monotone" dataKey="weight" stroke="url(#lineGrad)" strokeWidth={2.5}
                dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#4ade80' }} name="Weight (lbs)" />
              <Line type="monotone" dataKey="oneRM" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3"
                dot={false} name="Est. 1RM" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-gray-600 py-8">No data for {chartExercise} yet</p>
        )}
      </div>

      {/* Recent sessions */}
      <div className="card p-4">
        <p className="section-label">Recent Sessions</p>
        {recentGroups.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-5">No workouts yet. Start lifting!</p>
        ) : recentGroups.map(([date, items]) => (
          <div key={date} className="mb-4 last:mb-0">
            <p className="text-[11px] text-gray-600 font-semibold mb-2">{date}</p>
            {items.map(w => (
              <motion.div key={w.id} layout
                className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                <div className="w-1 h-8 rounded-full bg-brand-500/40 shrink-0" />
                <span className="flex-1 text-sm font-semibold text-gray-200">{w.exercise}</span>
                <span className="text-xs text-gray-500">{w.weight}lbs × {w.reps} × {w.sets}</span>
                {prs[w.exercise] === w.weight && <span className="text-[10px] text-amber-400 font-bold">PR</span>}
                <motion.button whileTap={{ scale: 0.8 }} onClick={() => deleteWorkout(w.id)}
                  className="text-gray-700 hover:text-red-400 transition-colors text-lg w-6 text-center">×</motion.button>
              </motion.div>
            ))}
          </div>
        ))}
      </div>
      {/* Plan exercises sheet */}
      <AnimatePresence>
        {showPlanSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowPlanSheet(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 pb-10 max-h-[80vh] overflow-y-auto"
              style={{ background: '#141720', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
              <p className="text-base font-black text-white mb-1">Recommended Exercises</p>
              <p className="text-xs text-gray-500 mb-5">Tap an exercise to pre-fill the form, then enter your weight and log it.</p>
              <div className="space-y-3">
                {planLifts.map((lift, i) => (
                  <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => prefillExercise(lift)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{lift.exercise}</p>
                      {lift.reason && <p className="text-xs text-gray-500 mt-0.5">{lift.reason}</p>}
                    </div>
                    <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2.5 py-1 rounded-lg shrink-0">{lift.setsReps}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Analyze overlay */}
      <AnimatePresence>
        {showAnalysis && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowAnalysis(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 pb-10 max-h-[85vh] overflow-y-auto"
              style={{ background: '#141720', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
              <p className="text-base font-black text-white mb-1">🧠 Plan Analysis</p>
              <p className="text-xs text-gray-500 mb-5">AI review of your routine vs your goal physique.</p>
              {analyzing ? (
                <div className="flex flex-col items-center py-10 gap-4">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <motion.div key={i} className="w-2 h-2 bg-indigo-400 rounded-full"
                        animate={{ y: [0,-8,0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                    ))}
                  </div>
                  <p className="text-sm text-gray-500">Analyzing your workouts...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analysisText.split('\n\n').map((block, i) => {
                    const lines = block.trim().split('\n')
                    const isHeader = lines[0].startsWith('##')
                    const header = isHeader ? lines[0].replace(/^#+\s*/, '') : null
                    const body = isHeader ? lines.slice(1).filter(Boolean) : lines.filter(Boolean)
                    return (
                      <div key={i} className="rounded-2xl p-4"
                        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                        {header && <p className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase mb-2">{header}</p>}
                        {body.map((line, j) => (
                          <p key={j} className="text-sm text-gray-300 leading-relaxed mb-1">
                            {renderBold(line.replace(/^[-•]\s*/, ''))}
                          </p>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}

function groupByDate(workouts) {
  const map = new Map()
  for (const w of workouts) {
    const d = format(new Date(w.created_at), 'MMM d, yyyy')
    if (!map.has(d)) map.set(d, [])
    map.get(d).push(w)
  }
  return [...map.entries()]
}
