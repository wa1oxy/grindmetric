import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../contexts/AppContext'
import { analyzeWorkoutPlan } from '../lib/gemini'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format } from 'date-fns'

const ALL_EXERCISES = [
  // Chest
  'Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Dumbbell Fly', 'Cable Fly',
  'Push-up', 'Decline Push-up', 'Diamond Push-up', 'Wide Push-up', 'Pike Push-up', 'Chest Dip',
  // Back
  'Deadlift', 'Bent-Over Row', 'Barbell Row', 'Dumbbell Row', 'Seated Cable Row', 'Lat Pulldown',
  'Pull-up', 'Chin-up', 'Weighted Pull-up', 'T-Bar Row', 'Face Pull', 'Inverted Row',
  // Shoulders
  'OHP', 'Overhead Press', 'Dumbbell Press', 'Arnold Press', 'Lateral Raise', 'Front Raise',
  'Rear Delt Fly', 'Upright Row', 'Shrug',
  // Legs
  'Squat', 'Back Squat', 'Front Squat', 'Goblet Squat', 'Romanian Deadlift', 'RDL',
  'Leg Press', 'Leg Extension', 'Leg Curl', 'Bulgarian Split Squat', 'Lunge', 'Walking Lunge',
  'Step-up', 'Hip Thrust', 'Glute Bridge', 'Calf Raise', 'Seated Calf Raise',
  // Arms
  'Bicep Curl', 'Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl',
  'Tricep Extension', 'Skull Crusher', 'Tricep Pushdown', 'Close-Grip Bench', 'Dip',
  // Core
  'Plank', 'Crunch', 'Sit-up', 'Leg Raise', 'Hanging Leg Raise', 'Ab Wheel', 'Russian Twist',
  'Mountain Climber', 'Hollow Hold',
  // Cardio / Athletic
  'Burpee', 'Box Jump', 'Jump Squat', 'Jump Rope', 'Running', 'Sprint',
]

const BODYWEIGHT_EXERCISES = new Set([
  'Push-up', 'Decline Push-up', 'Diamond Push-up', 'Wide Push-up', 'Pike Push-up',
  'Pull-up', 'Chin-up', 'Inverted Row', 'Chest Dip', 'Dip',
  'Plank', 'Crunch', 'Sit-up', 'Leg Raise', 'Hanging Leg Raise', 'Ab Wheel',
  'Russian Twist', 'Mountain Climber', 'Hollow Hold',
  'Burpee', 'Box Jump', 'Jump Squat', 'Lunge', 'Walking Lunge', 'Step-up',
  'Glute Bridge',
])

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
        defaultSets: setsMatch ? parseInt(setsMatch[1]) : 3,
        defaultReps: setsMatch ? parseInt(setsMatch[2]) : 10,
        reason: parts[2] || '',
      }
    }).filter(Boolean)
}

function calcOneRM(weight, reps) { return Math.round(weight * (1 + reps / 30)) }

function groupByDate(workouts) {
  const map = new Map()
  for (const w of workouts) {
    const d = format(new Date(w.created_at), 'MMM d, yyyy')
    if (!map.has(d)) map.set(d, [])
    map.get(d).push(w)
  }
  return [...map.entries()]
}

function renderBold(text) {
  if (!text) return null
  return text.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="text-white font-bold">{p.slice(2, -2)}</strong>
      : p
  )
}

// ─── Log Modal ───────────────────────────────────────────────────────────────
function LogModal({ exercise, defaultSets, defaultReps, onLog, onClose }) {
  const isBodyweight = BODYWEIGHT_EXERCISES.has(exercise)
  const [mode, setMode] = useState(isBodyweight ? 'bodyweight' : 'weighted')
  const [extraWeight, setExtraWeight] = useState(false)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState(String(defaultReps || 10))
  const [sets, setSets] = useState(String(defaultSets || 3))

  const adj = (setter, val, step, min = 0) => setter(String(Math.max(min, (parseFloat(val) || 0) + step)))

  const canLog = sets && reps && (mode === 'bodyweight' ? (!extraWeight || weight) : weight)

  const handleLog = () => {
    const w = mode === 'bodyweight'
      ? (extraWeight ? parseFloat(weight) || 0 : 0)
      : parseFloat(weight) || 0
    onLog({ exercise, weight: w, reps: parseInt(reps), sets: parseInt(sets) })
  }

  return (
    <>
      {/* backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={onClose} />

      {/* card */}
      <motion.div initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6 pb-10"
        style={{
          background: 'linear-gradient(180deg,#111827 0%,#0d1117 100%)',
          border: '1px solid rgba(34,197,94,0.25)',
          boxShadow: '0 -8px 60px rgba(34,197,94,0.15), 0 -2px 20px rgba(34,197,94,0.08)',
        }}>

        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />
        <p className="text-xl font-black text-white mb-5">{exercise}</p>

        {/* Bodyweight / Weighted toggle */}
        {isBodyweight && (
          <div className="flex gap-2 mb-5">
            {['bodyweight', 'weighted'].map(m => (
              <button key={m} onClick={() => { setMode(m); setExtraWeight(false) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={mode === m
                  ? { background: 'linear-gradient(135deg,#22c55e,#4ade80)', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.08)' }}>
                {m === 'bodyweight' ? '🤸 Bodyweight' : '🏋️ Weighted'}
              </button>
            ))}
          </div>
        )}

        {/* Extra weight toggle for bodyweight */}
        {mode === 'bodyweight' && (
          <div className="mb-4">
            <button onClick={() => setExtraWeight(v => !v)}
              className="flex items-center gap-2 text-sm text-gray-400">
              <div className={`w-10 h-5 rounded-full transition-colors relative ${extraWeight ? 'bg-green-500' : 'bg-white/10'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${extraWeight ? 'left-5' : 'left-0.5'}`} />
              </div>
              Add extra weight
            </button>
          </div>
        )}

        {/* Weight input */}
        {(mode === 'weighted' || (mode === 'bodyweight' && extraWeight)) && (
          <div className="mb-4">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">
              {mode === 'bodyweight' ? 'Extra Weight (lbs)' : 'Weight (lbs)'}
            </p>
            <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => adj(setWeight, weight, -5, 0)} className="w-10 h-10 rounded-xl bg-white/5 text-white font-bold text-lg flex items-center justify-center">−</button>
              <input type="number" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)}
                placeholder="0" className="flex-1 text-center text-2xl font-black text-white bg-transparent outline-none" />
              <button onClick={() => adj(setWeight, weight, 5)} className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 font-bold text-lg flex items-center justify-center">+</button>
            </div>
          </div>
        )}

        {/* Reps + Sets */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[['Reps', reps, setReps, 1], ['Sets', sets, setSets, 1]].map(([label, val, setter, step]) => (
            <div key={label} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest text-center mb-2">{label}</p>
              <div className="flex items-center gap-2 justify-center">
                <button onClick={() => adj(setter, val, -step, 1)} className="w-9 h-9 rounded-xl bg-white/5 text-white font-bold text-lg flex items-center justify-center">−</button>
                <input type="number" inputMode="numeric" value={val} onChange={e => setter(e.target.value)}
                  className="w-12 text-center text-2xl font-black text-white bg-transparent outline-none" />
                <button onClick={() => adj(setter, val, step)} className="w-9 h-9 rounded-xl bg-green-500/20 text-green-400 font-bold text-lg flex items-center justify-center">+</button>
              </div>
            </div>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={handleLog} disabled={!canLog}
          className="w-full py-4 rounded-2xl text-base font-black text-black disabled:opacity-30"
          style={{ background: 'linear-gradient(135deg,#22c55e,#4ade80)', boxShadow: '0 4px 24px rgba(34,197,94,0.35)' }}>
          Log It 💪
        </motion.button>
      </motion.div>
    </>
  )
}

// ─── Analysis Sheet ───────────────────────────────────────────────────────────
function AnalysisSheet({ workouts, workoutPlan, user, onClose }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  useState(() => {
    analyzeWorkoutPlan({
      workoutHistory: workouts,
      workoutPlan,
      dreamPhotoBase64: user?.profile?.dreamPhoto ? user.profile.dreamPhoto.split(',')[1] : null,
      userProfile: user?.profile,
    }).then(r => { setText(r || 'Could not analyze. Try again.'); setLoading(false) })
  }, [])

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 pb-10 max-h-[85vh] overflow-y-auto"
        style={{ background: 'linear-gradient(180deg,#111827 0%,#0d1117 100%)', border: '1px solid rgba(99,102,241,0.25)', boxShadow: '0 -8px 60px rgba(99,102,241,0.12)' }}>
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />
        <p className="text-base font-black text-white mb-1">Plan Analysis</p>
        <p className="text-xs text-gray-600 mb-5">Is your routine actually building your goal physique?</p>
        {loading ? (
          <div className="flex flex-col items-center py-12 gap-4">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-2 h-2 bg-indigo-400 rounded-full"
                animate={{ y: [0,-8,0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
            ))}
            <p className="text-sm text-gray-600">Analyzing your workouts...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {text.split('\n\n').map((block, i) => {
              const lines = block.trim().split('\n')
              const isHeader = lines[0].startsWith('##')
              const header = isHeader ? lines[0].replace(/^#+\s*/, '') : null
              const body = isHeader ? lines.slice(1).filter(Boolean) : lines.filter(Boolean)
              return (
                <div key={i} className="rounded-2xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                  {header && <p className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase mb-2">{header}</p>}
                  {body.map((line, j) => (
                    <p key={j} className="text-sm text-gray-300 leading-relaxed mb-1">{renderBold(line.replace(/^[-•]\s*/, ''))}</p>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Workout() {
  const { workouts, addWorkout, deleteWorkout, user } = useApp()
  const [search, setSearch] = useState('')
  const [logTarget, setLogTarget] = useState(null) // { exercise, defaultSets, defaultReps }
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [toast, setToast] = useState(null)
  const [chartExercise, setChartExercise] = useState('Bench Press')

  const workoutPlan = user?.profile?.workoutPlan
  const planLifts = parsePlanLifts(workoutPlan)

  // PR map
  const prs = useMemo(() => {
    const m = {}
    for (const w of workouts) {
      if (!m[w.exercise] || w.weight > m[w.exercise]) m[w.exercise] = w.weight
    }
    return m
  }, [workouts])

  // Previous exercises (unique, excluding plan ones)
  const prevExercises = useMemo(() => {
    const planNames = new Set(planLifts.map(l => l.exercise.toLowerCase()))
    const seen = new Set()
    return workouts
      .map(w => w.exercise)
      .filter(e => { if (seen.has(e) || planNames.has(e.toLowerCase())) return false; seen.add(e); return true })
      .slice(0, 10)
  }, [workouts, planLifts])

  // Search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    const matches = ALL_EXERCISES.filter(e => e.toLowerCase().includes(q))
    if (search.trim() && !ALL_EXERCISES.find(e => e.toLowerCase() === q)) {
      matches.push(search.trim()) // allow custom
    }
    return matches.slice(0, 8)
  }, [search])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000) }

  const handleLog = (entry) => {
    addWorkout(entry)
    setLogTarget(null)
    showToast(`${entry.exercise} logged! 💪`)
  }

  // Chart
  const chartData = workouts
    .filter(w => w.exercise === chartExercise)
    .map(w => ({ date: format(new Date(w.created_at), 'MM/dd'), weight: w.weight, oneRM: calcOneRM(w.weight, w.reps) }))
    .reverse().slice(-12)

  const recentGroups = groupByDate(workouts.slice(0, 30))
  const allExercises = [...new Set([...planLifts.map(l => l.exercise), ...workouts.map(w => w.exercise)])]

  return (
    <div className="tab-page">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-bold px-6 py-3 rounded-full"
            style={{ background: 'linear-gradient(135deg,#22c55e,#4ade80)', color: '#000', boxShadow: '0 4px 24px rgba(34,197,94,0.5)' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[28px] font-black text-white tracking-tight">Lift</h2>
        {workoutPlan && (
          <motion.button whileTap={{ scale: 0.93 }} onClick={() => setShowAnalysis(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
            🧠 Analyze
          </motion.button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search any exercise..."
          className="w-full pl-9 pr-4 py-3 rounded-2xl text-sm text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute left-0 right-0 top-full mt-1 rounded-2xl overflow-hidden z-20"
              style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              {searchResults.map((e, i) => (
                <button key={i} onClick={() => { setLogTarget({ exercise: e }); setSearch('') }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-200 border-b border-white/[0.04] last:border-0 active:bg-white/5 flex items-center justify-between">
                  <span>{e}</span>
                  <span className="text-[10px] text-green-400 font-bold">LOG →</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Today's Schedule */}
      {planLifts.length > 0 && (
        <section className="mb-6">
          <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-3">Today's Plan</p>
          <div className="space-y-2">
            {planLifts.map((lift, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{lift.exercise}</p>
                  {lift.setsReps && <p className="text-xs text-gray-600 mt-0.5">{lift.setsReps}</p>}
                </div>
                <motion.button whileTap={{ scale: 0.92 }}
                  onClick={() => setLogTarget({ exercise: lift.exercise, defaultSets: lift.defaultSets, defaultReps: lift.defaultReps })}
                  className="shrink-0 px-4 py-2 rounded-xl text-xs font-black text-black"
                  style={{ background: 'linear-gradient(135deg,#22c55e,#4ade80)', boxShadow: '0 2px 12px rgba(34,197,94,0.3)' }}>
                  Log
                </motion.button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Previous Exercises */}
      {prevExercises.length > 0 && (
        <section className="mb-6">
          <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-3">Previous Exercises</p>
          <div className="space-y-2">
            {prevExercises.map((ex, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-200">{ex}</p>
                  {prs[ex] && <p className="text-xs text-gray-600 mt-0.5">PR: {prs[ex]} lbs</p>}
                </div>
                <motion.button whileTap={{ scale: 0.92 }}
                  onClick={() => setLogTarget({ exercise: ex })}
                  className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-gray-400"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Log
                </motion.button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Strength Chart */}
      {workouts.length > 0 && (
        <div className="card p-4 mb-4">
          <p className="text-sm font-bold text-white mb-3">Strength Progression</p>
          <select value={chartExercise} onChange={e => setChartExercise(e.target.value)}
            className="input-field w-full h-10 text-sm mb-3">
            {[...new Set([...planLifts.map(l => l.exercise), ...workouts.map(w => w.exercise)])].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <defs>
                  <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#4ade80" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#141720', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff', fontSize: 12 }} cursor={{ stroke: 'rgba(34,197,94,0.2)', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="weight" stroke="url(#lg)" strokeWidth={2.5} dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#4ade80' }} name="Weight (lbs)" />
                <Line type="monotone" dataKey="oneRM" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Est. 1RM" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-gray-600 py-6">No data yet</p>
          )}
        </div>
      )}

      {/* Recent Sessions */}
      {recentGroups.length > 0 && (
        <div className="card p-4">
          <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-3">Recent Sessions</p>
          {recentGroups.map(([date, items]) => (
            <div key={date} className="mb-4 last:mb-0">
              <p className="text-[11px] text-gray-700 font-semibold mb-2">{date}</p>
              {items.map(w => (
                <motion.div key={w.id} layout
                  className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                  <div className="w-1 h-7 rounded-full bg-green-500/30 shrink-0" />
                  <span className="flex-1 text-sm font-semibold text-gray-200">{w.exercise}</span>
                  <span className="text-xs text-gray-600">{w.weight > 0 ? `${w.weight}lbs × ` : ''}{w.reps} × {w.sets}</span>
                  {prs[w.exercise] === w.weight && w.weight > 0 && <span className="text-[10px] text-amber-400 font-bold">PR</span>}
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => deleteWorkout(w.id)}
                    className="text-gray-700 hover:text-red-400 transition-colors text-lg w-6 text-center">×</motion.button>
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Log modal */}
      <AnimatePresence>
        {logTarget && (
          <LogModal
            exercise={logTarget.exercise}
            defaultSets={logTarget.defaultSets}
            defaultReps={logTarget.defaultReps}
            onLog={handleLog}
            onClose={() => setLogTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* Analysis sheet */}
      <AnimatePresence>
        {showAnalysis && (
          <AnalysisSheet workouts={workouts} workoutPlan={workoutPlan} user={user} onClose={() => setShowAnalysis(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
