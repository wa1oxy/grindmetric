import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../contexts/AppContext'
import { analyzeWorkoutPlan, customizeWorkoutPlan, chatWithCoach } from '../lib/gemini'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format } from 'date-fns'

// ─── Exercise metadata ────────────────────────────────────────────────────────
const CATEGORIES = {
  chest:     { label: 'Chest',     color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',    keywords: ['bench','push-up','push up','fly','chest','dip','pec'] },
  back:      { label: 'Back',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',   keywords: ['row','pull','lat pull','pulldown','deadlift','rdl','chin','inverted'] },
  legs:      { label: 'Legs',      color: '#f97316', bg: 'rgba(249,115,22,0.12)',   keywords: ['squat','lunge','leg press','leg ext','leg curl','hip thrust','glute','calf','step-up','split squat','bulgarian'] },
  shoulders: { label: 'Shoulders', color: '#a855f7', bg: 'rgba(168,85,247,0.12)',   keywords: ['shoulder press','ohp','overhead press','arnold','lateral raise','front raise','rear delt','shrug','upright row','face pull'] },
  arms:      { label: 'Arms',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   keywords: ['curl','tricep','bicep','hammer','skull','close-grip','pushdown','extension'] },
  core:      { label: 'Core',      color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',    keywords: ['plank','crunch','sit-up','ab wheel','ab roller','russian twist','mountain climber','hollow','leg raise','hanging leg'] },
  cardio:    { label: 'Cardio',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',    keywords: ['run','sprint','jump rope','box jump','burpee','jump squat','cardio'] },
}

// Checked BEFORE keyword scan — handles ambiguous names
const EXERCISE_OVERRIDES = {
  'lateral raise':    'shoulders',
  'rear delt':        'shoulders',
  'upright row':      'shoulders',
  'face pull':        'shoulders',
  'arnold press':     'shoulders',
  'overhead press':   'shoulders',
  'shoulder press':   'shoulders',
  'tricep pushdown':  'arms',
  'pushdown':         'arms',
  'tricep extension': 'arms',
  'skull crusher':    'arms',
  'close-grip bench': 'arms',
  'leg raise':        'core',
  'hanging leg':      'core',
  'romanian deadlift':'legs',
  'hip thrust':       'legs',
  'glute bridge':     'legs',
  'walking lunge':    'legs',
  'step-up':          'legs',
  'jump rope':        'cardio',
  'box jump':         'cardio',
}

function getCategory(name) {
  const n = name.toLowerCase()
  for (const [pattern, catKey] of Object.entries(EXERCISE_OVERRIDES)) {
    if (n.includes(pattern)) return { key: catKey, ...CATEGORIES[catKey] }
  }
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (cat.keywords.some(k => n.includes(k))) return { key, ...cat }
  }
  return { key: 'other', label: 'Other', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' }
}

const ALL_EXERCISES = [
  'Bench Press','Incline Bench Press','Decline Bench Press','Dumbbell Fly','Cable Fly',
  'Push-up','Decline Push-up','Diamond Push-up','Wide Push-up','Pike Push-up','Chest Dip',
  'Deadlift','Bent-Over Row','Barbell Row','Dumbbell Row','Seated Cable Row','Lat Pulldown',
  'Pull-up','Chin-up','Weighted Pull-up','T-Bar Row','Face Pull','Inverted Row',
  'OHP','Overhead Press','Dumbbell Shoulder Press','Arnold Press','Lateral Raise','Front Raise',
  'Rear Delt Fly','Upright Row','Shrug',
  'Squat','Back Squat','Front Squat','Goblet Squat','Romanian Deadlift','RDL',
  'Leg Press','Leg Extension','Leg Curl','Bulgarian Split Squat','Lunge','Walking Lunge',
  'Step-up','Hip Thrust','Glute Bridge','Calf Raise','Seated Calf Raise',
  'Bicep Curl','Barbell Curl','Dumbbell Curl','Hammer Curl','Preacher Curl','Cable Curl',
  'Tricep Extension','Skull Crusher','Tricep Pushdown','Close-Grip Bench','Dip',
  'Plank','Crunch','Sit-up','Leg Raise','Hanging Leg Raise','Ab Wheel','Russian Twist',
  'Mountain Climber','Hollow Hold',
  'Burpee','Box Jump','Jump Squat','Jump Rope','Running','Sprint',
]

const BODYWEIGHT_EXERCISES = new Set([
  'Push-up','Decline Push-up','Diamond Push-up','Wide Push-up','Pike Push-up',
  'Pull-up','Chin-up','Inverted Row','Chest Dip','Dip',
  'Plank','Crunch','Sit-up','Leg Raise','Hanging Leg Raise','Ab Wheel',
  'Russian Twist','Mountain Climber','Hollow Hold',
  'Burpee','Box Jump','Jump Squat','Lunge','Walking Lunge','Step-up','Glute Bridge',
])

function parsePlanLifts(plan) {
  if (!plan) return []
  const match = plan.match(/## KEY LIFTS\n([\s\S]*?)(?=\n##|$)/)
  if (!match) return []
  return match[1].split('\n')
    .map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean)
    .map(line => {
      const parts = line.split('|').map(s => s.replace(/\*\*/g, '').trim())
      if (!parts[0]) return null
      const setsReps = parts[1] || ''
      const setsMatch = setsReps.match(/(\d+)\s*[x×]\s*([\d\-]+)/)
      return { exercise: parts[0], setsReps, defaultSets: setsMatch ? parseInt(setsMatch[1]) : 3, defaultReps: setsMatch ? parseInt(setsMatch[2]) : 10, reason: parts[2] || '' }
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
      ? <strong key={i} className="text-white font-bold">{p.slice(2,-2)}</strong> : p
  )
}

// ─── Log Modal ────────────────────────────────────────────────────────────────
function LogModal({ exercise, defaultSets, defaultReps, onLog, onClose }) {
  const isBW = BODYWEIGHT_EXERCISES.has(exercise)
  const cat = getCategory(exercise)
  const [mode, setMode] = useState(isBW ? 'bodyweight' : 'weighted')
  const [extraWeight, setExtraWeight] = useState(false)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState(String(defaultReps || 10))
  const [sets, setSets] = useState(String(defaultSets || 3))
  const adj = (setter, val, step, min = 0) => setter(String(Math.max(min, (parseFloat(val)||0) + step)))
  const canLog = sets && reps && (mode === 'bodyweight' ? (!extraWeight || weight) : weight)

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.75)' }}
        onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-[28px] px-5 pt-5"
        style={{ background: '#0d1117', border: `1px solid ${cat.color}30`, boxShadow: `0 -12px 60px ${cat.color}18, 0 -2px 0 ${cat.color}40`, paddingBottom: 'max(110px, calc(env(safe-area-inset-bottom) + 90px))' }}>

        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: cat.color + '40' }} />

        {/* Exercise header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: cat.bg }}>
            <span className="text-lg">{cat.key === 'chest' ? '🏋️' : cat.key === 'back' ? '🚣' : cat.key === 'legs' ? '🦵' : cat.key === 'shoulders' ? '🙌' : cat.key === 'arms' ? '💪' : cat.key === 'core' ? '🎯' : '⚡'}</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: cat.color }}>{cat.label}</p>
            <p className="text-lg font-black text-white leading-tight">{exercise}</p>
          </div>
        </div>

        {/* BW / Weighted toggle */}
        {isBW && (
          <div className="flex gap-2 mb-4 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {[['bodyweight','🤸 Bodyweight'],['weighted','🏋️ Weighted']].map(([m, lbl]) => (
              <button key={m} onClick={() => { setMode(m); setExtraWeight(false) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={mode === m ? { background: cat.color, color: '#000' } : { color: '#6b7280' }}>
                {lbl}
              </button>
            ))}
          </div>
        )}

        {mode === 'bodyweight' && (
          <button onClick={() => setExtraWeight(v => !v)}
            className="flex items-center gap-2.5 mb-4 text-sm text-gray-400">
            <div className="w-11 h-6 rounded-full relative transition-colors" style={{ background: extraWeight ? cat.color : 'rgba(255,255,255,0.1)' }}>
              <motion.div animate={{ x: extraWeight ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full" />
            </div>
            Add extra weight
          </button>
        )}

        {(mode === 'weighted' || (mode === 'bodyweight' && extraWeight)) && (
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: cat.color }}>
              {mode === 'bodyweight' ? 'Extra Weight (lbs)' : 'Weight (lbs)'}
            </p>
            <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${cat.color}25` }}>
              <button onClick={() => adj(setWeight, weight, -5, 0)} className="w-11 h-11 rounded-xl text-white font-black text-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>−</button>
              <input type="number" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)}
                placeholder="0" className="flex-1 text-center text-3xl font-black text-white bg-transparent outline-none" />
              <button onClick={() => adj(setWeight, weight, 5)} className="w-11 h-11 rounded-xl font-black text-xl flex items-center justify-center" style={{ background: cat.bg, color: cat.color }}>+</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[['Reps', reps, setReps, 1], ['Sets', sets, setSets, 1]].map(([label, val, setter, step]) => (
            <div key={label} className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-center mb-2.5" style={{ color: cat.color }}>{label}</p>
              <div className="flex items-center gap-2 justify-center">
                <button onClick={() => adj(setter, val, -step, 1)} className="w-10 h-10 rounded-xl text-white font-black text-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>−</button>
                <input type="number" inputMode="numeric" value={val} onChange={e => setter(e.target.value)}
                  className="w-14 text-center text-2xl font-black text-white bg-transparent outline-none" />
                <button onClick={() => adj(setter, val, step)} className="w-10 h-10 rounded-xl font-black text-lg flex items-center justify-center" style={{ background: cat.bg, color: cat.color }}>+</button>
              </div>
            </div>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={() => onLog({ exercise, weight: mode === 'bodyweight' && !extraWeight ? 0 : parseFloat(weight)||0, reps: parseInt(reps), sets: parseInt(sets) })}
          disabled={!canLog}
          className="w-full py-4 rounded-2xl text-base font-black text-black disabled:opacity-30"
          style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)`, boxShadow: `0 4px 24px ${cat.color}40` }}>
          Log It 💪
        </motion.button>
      </motion.div>
    </>
  )
}

// ─── AI Tips Chat ────────────────────────────────────────────────────────────
const INITIAL_MESSAGE = { role: 'ai', text: "Ask me anything — form tips, exercise swaps, recovery, nutrition, programming questions. I have access to all your data." }

function AiTipsChat({ user, todayWorkouts, todayNutrition, todayFoods, foods, workouts, weightLogs, streak, saveProfile, onClose }) {
  const chatKey = `gm_ai_chat_${new Date().toISOString().split('T')[0]}`
  const [messages, setMessagesState] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(chatKey)); return saved?.length ? saved : [INITIAL_MESSAGE] } catch { return [INITIAL_MESSAGE] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedMemory, setSavedMemory] = useState(null)
  const bottomRef = useRef(null)

  const setMessages = (updater) => {
    setMessagesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      localStorage.setItem(chatKey, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = async () => {
    if (!input.trim() || loading) return
    const req = input.trim()
    setInput('')
    const newMessages = [...messages, { role: 'user', text: req }]
    setMessages(newMessages)
    setLoading(true)
    const result = await chatWithCoach({
      messages: newMessages,
      userProfile: user?.profile,
      todayWorkouts,
      todayNutrition,
      todayFoods,
      foods,
      workouts,
      weightLogs,
      streak,
    })
    const raw = result || "Sorry, couldn't get a response. Try again."

    // Parse and save any [MEMORY: ...] tags
    const memMatch = raw.match(/\[MEMORY:\s*(.+?)\]/i)
    if (memMatch && saveProfile) {
      const note = memMatch[1].trim()
      const existing = user?.profile?.aiMemory || ''
      const updated = existing ? `${existing}\n- ${note}` : `- ${note}`
      saveProfile({ aiMemory: updated })
      setSavedMemory(note)
      setTimeout(() => setSavedMemory(null), 3000)
    }
    const cleanText = raw.replace(/\[MEMORY:.*?\]\n?/gi, '').trim()
    setMessages(m => [...m, { role: 'ai', text: cleanText }])
    setLoading(false)
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 z-[55] backdrop-blur-md" style={{ background:'rgba(0,0,0,0.75)' }} onClick={onClose} />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:320 }}
        className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-[28px] flex flex-col"
        style={{ background:'#0d1117', border:'1px solid rgba(34,197,94,0.25)', maxHeight:'80vh', paddingBottom:'env(safe-area-inset-bottom)' }}>
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-brand-500/20 flex items-center justify-center text-lg">🤖</div>
              <div>
                <p className="text-base font-black text-white leading-none">AI Coach</p>
                <p className="text-[10px] text-brand-500 font-semibold">Ask anything fitness</p>
              </div>
            </div>
            <AnimatePresence>
              {savedMemory && (
                <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.9 }}
                  className="text-[10px] font-bold px-3 py-1.5 rounded-full"
                  style={{ background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#4ade80' }}>
                  ✓ Remembered
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={m.role === 'user'
                  ? { background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.25)', color:'#d1fae5' }
                  : { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#d1d5db' }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 flex gap-1.5 items-center" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                {[0,1,2].map(i => <motion.div key={i} className="w-1.5 h-1.5 bg-brand-400 rounded-full" animate={{ y:[0,-4,0] }} transition={{ repeat:Infinity, duration:0.7, delay:i*0.12 }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="px-4 py-3 shrink-0 flex gap-2" style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingBottom:'max(16px, calc(env(safe-area-inset-bottom) + 8px))' }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder='e.g. "How do I fix my squat form?"'
            className="flex-1 px-4 py-3 rounded-2xl text-sm text-white outline-none"
            style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }} />
          <motion.button whileTap={{ scale:0.92 }} onClick={send} disabled={!input.trim() || loading}
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-black text-lg disabled:opacity-30"
            style={{ background:'linear-gradient(135deg,#22c55e,#4ade80)' }}>
            ↑
          </motion.button>
        </div>
      </motion.div>
    </>
  )
}

// ─── Schedule Picker ─────────────────────────────────────────────────────────
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DAY_STATES = ['gym','home','rest']
const DAY_LABELS = { gym: '🏋️', home: '🏠', rest: '😴' }
const DAY_COLORS = { gym: '#22c55e', home: '#3b82f6', rest: '#374151' }

function SchedulePicker({ schedule, onChange, onClose }) {
  const [local, setLocal] = useState(() => schedule || { Mon:'gym',Tue:'rest',Wed:'gym',Thu:'rest',Fri:'gym',Sat:'home',Sun:'rest' })

  const cycle = (day) => {
    const cur = DAY_STATES.indexOf(local[day])
    setLocal(s => ({ ...s, [day]: DAY_STATES[(cur + 1) % 3] }))
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 z-40 backdrop-blur-md" style={{ background:'rgba(0,0,0,0.75)' }} onClick={() => { onChange(local); onClose() }} />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:320 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] px-5 pt-5"
        style={{ background:'#0d1117', border:'1px solid rgba(255,255,255,0.08)', paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}>
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-5" />
        <p className="text-lg font-black text-white mb-1">Weekly Schedule</p>
        <p className="text-xs text-gray-600 mb-5">Tap each day to cycle between gym, home, and rest.</p>
        <div className="grid grid-cols-7 gap-1.5 mb-6">
          {DAYS.map(day => {
            const state = local[day] || 'rest'
            const color = DAY_COLORS[state]
            return (
              <motion.button key={day} whileTap={{ scale:0.88 }} onClick={() => cycle(day)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl"
                style={{ background: state === 'rest' ? 'rgba(255,255,255,0.04)' : color + '18', border: `1px solid ${color}40` }}>
                <span className="text-base">{DAY_LABELS[state]}</span>
                <span className="text-[10px] font-bold" style={{ color: state === 'rest' ? '#4b5563' : color }}>{day}</span>
              </motion.button>
            )
          })}
        </div>
        <div className="flex gap-3 text-xs text-gray-600 justify-center mb-6">
          {Object.entries(DAY_LABELS).map(([k,v]) => (
            <span key={k} className="flex items-center gap-1">{v} <span style={{ color: DAY_COLORS[k] }}>{k.charAt(0).toUpperCase()+k.slice(1)}</span></span>
          ))}
        </div>
        <motion.button whileTap={{ scale:0.97 }} onClick={() => { onChange(local); onClose() }}
          className="w-full py-4 rounded-2xl text-base font-black text-black"
          style={{ background:'linear-gradient(135deg,#22c55e,#4ade80)', boxShadow:'0 4px 24px rgba(34,197,94,0.3)' }}>
          Save Schedule
        </motion.button>
      </motion.div>
    </>
  )
}

// ─── Plan Chat Sheet ──────────────────────────────────────────────────────────
function PlanChat({ plan, user, onPlanUpdate, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "What would you like to change about your plan? You can ask me to swap exercises, adjust days, change volume, or anything else." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!input.trim() || loading) return
    const req = input.trim()
    setInput('')
    setMessages(m => [...m, { role: 'user', text: req }])
    setLoading(true)
    const result = await customizeWorkoutPlan({ currentPlan: plan, request: req, userProfile: user?.profile })
    if (result) {
      setMessages(m => [...m, { role: 'ai', text: result.reply, newPlan: result.newPlan }])
      onPlanUpdate(result.newPlan)
    } else {
      setMessages(m => [...m, { role: 'ai', text: "Sorry, couldn't process that. Try again." }])
    }
    setLoading(false)
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 z-40 backdrop-blur-md" style={{ background:'rgba(0,0,0,0.75)' }} onClick={onClose} />
      <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:320 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] flex flex-col"
        style={{ background:'#0d1117', border:'1px solid rgba(34,197,94,0.2)', maxHeight:'80vh' }}>
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-4" />
          <p className="text-lg font-black text-white mb-0.5">Tweak Your Plan</p>
          <p className="text-xs text-gray-600">Chat with AI to change anything about your workout plan.</p>
        </div>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={m.role === 'user'
                  ? { background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.25)', color:'#d1fae5' }
                  : { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#d1d5db' }}>
                {m.role === 'ai' && <span className="text-green-400 font-bold text-xs block mb-1">🤖 AI Coach</span>}
                {m.text}
                {m.newPlan && <p className="text-[10px] text-green-400 mt-2 font-bold">✓ Plan updated</p>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 flex gap-1.5 items-center" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                {[0,1,2].map(i => <motion.div key={i} className="w-1.5 h-1.5 bg-green-400 rounded-full" animate={{ y:[0,-4,0] }} transition={{ repeat:Infinity, duration:0.7, delay:i*0.12 }} />)}
              </div>
            </div>
          )}
        </div>
        {/* Input */}
        <div className="px-4 py-4 pb-10 shrink-0 flex gap-2" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder='e.g. "Skip legs" or "More chest work"'
            className="flex-1 px-4 py-3 rounded-2xl text-sm text-white outline-none"
            style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }} />
          <motion.button whileTap={{ scale:0.92 }} onClick={send} disabled={!input.trim() || loading}
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-black disabled:opacity-30"
            style={{ background:'linear-gradient(135deg,#22c55e,#4ade80)' }}>
            →
          </motion.button>
        </div>
      </motion.div>
    </>
  )
}

// ─── Analysis Sheet ───────────────────────────────────────────────────────────
function AnalysisSheet({ workouts, workoutPlan, user, onClose }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  useState(() => {
    analyzeWorkoutPlan({ workoutHistory: workouts, workoutPlan, dreamPhotoBase64: user?.profile?.dreamPhoto ? user.profile.dreamPhoto.split(',')[1] : null, userProfile: user?.profile })
      .then(r => { setText(r || 'Could not analyze. Try again.'); setLoading(false) })
  }, [])

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] p-5 pb-10 max-h-[85vh] overflow-y-auto"
        style={{ background: '#0d1117', border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 -12px 60px rgba(99,102,241,0.15)' }}>
        <div className="w-10 h-1 bg-indigo-500/30 rounded-full mx-auto mb-5" />
        <p className="text-lg font-black text-white mb-0.5">Plan Analysis</p>
        <p className="text-xs text-gray-600 mb-5">Is your routine actually building your goal physique?</p>
        {loading ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="flex gap-1.5">{[0,1,2].map(i => <motion.div key={i} className="w-2 h-2 rounded-full bg-indigo-400" animate={{ y:[0,-8,0] }} transition={{ repeat:Infinity, duration:0.8, delay:i*0.15 }} />)}</div>
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
                <div key={i} className="rounded-2xl p-4" style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  {header && <p className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase mb-2">{header}</p>}
                  {body.map((line, j) => <p key={j} className="text-sm text-gray-300 leading-relaxed mb-0.5">{renderBold(line.replace(/^[-•]\s*/,''))}</p>)}
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </>
  )
}

// ─── Exercise Card ────────────────────────────────────────────────────────────
function ExerciseRow({ exercise, sub, onLog, showPR, pr, delay = 0 }) {
  const cat = getCategory(exercise)
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)' }}>
      {/* Color dot */}
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: cat.color, boxShadow: `0 0 6px ${cat.color}60` }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{exercise}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: cat.color + 'aa' }}>
          {sub || (showPR && pr ? `PR: ${pr} lbs` : cat.label)}
        </p>
      </div>
      <motion.button whileTap={{ scale: 0.88 }} onClick={onLog}
        className="shrink-0 w-14 py-2 rounded-xl text-xs font-black"
        style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.color}30` }}>
        Log
      </motion.button>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Workout() {
  const { workouts, addWorkout, deleteWorkout, user, saveProfile, todayWorkouts, todayNutrition, todayFoods, foods, weightLogs, streak } = useApp()
  const [search, setSearch] = useState('')
  const [logTarget, setLogTarget] = useState(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showPlanChat, setShowPlanChat] = useState(false)
  const [showAiChat, setShowAiChat] = useState(false)
  const [toast, setToast] = useState(null)
  const [chartExercise, setChartExercise] = useState('')
  const [currentPlan, setCurrentPlan] = useState(() => user?.profile?.workoutPlan || '')

  const workoutPlan = currentPlan
  const planLifts = parsePlanLifts(workoutPlan)
  const gymSchedule = user?.profile?.gymSchedule || {}
  const todayDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]
  const todayType = gymSchedule[todayDay] || 'gym'

  const todayStr = new Date().toISOString().split('T')[0]
  const loggedToday = workouts.filter(w => w.created_at.startsWith(todayStr))
  const loggedNames = new Set(loggedToday.map(w => w.exercise))

  const prs = useMemo(() => {
    const m = {}
    for (const w of workouts) { if (!m[w.exercise] || w.weight > m[w.exercise]) m[w.exercise] = w.weight }
    return m
  }, [workouts])

  const prevExercises = useMemo(() => {
    const planNames = new Set(planLifts.map(l => l.exercise.toLowerCase()))
    const seen = new Set()
    return workouts.map(w => w.exercise)
      .filter(e => { if (seen.has(e) || planNames.has(e.toLowerCase())) return false; seen.add(e); return true })
      .slice(0, 10)
  }, [workouts, planLifts])

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    const matches = ALL_EXERCISES.filter(e => e.toLowerCase().includes(q))
    if (!ALL_EXERCISES.find(e => e.toLowerCase() === q)) matches.push(search.trim())
    return matches.slice(0, 7)
  }, [search])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200) }
  const handleLog = (entry) => { addWorkout(entry); setLogTarget(null); showToast(`${entry.exercise} logged 💪`) }

  const defaultChart = planLifts[0]?.exercise || (workouts[0]?.exercise ?? 'Bench Press')
  const activeChart = chartExercise || defaultChart
  const chartData = workouts.filter(w => w.exercise === activeChart)
    .map(w => ({ date: format(new Date(w.created_at), 'MM/dd'), weight: w.weight, oneRM: calcOneRM(w.weight, w.reps) }))
    .reverse().slice(-12)

  const recentGroups = groupByDate(workouts.slice(0, 30))
  const loggedCount = planLifts.filter(l => loggedNames.has(l.exercise)).length

  return (
    <div className="tab-page">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-16, scale:0.9 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, scale:0.9 }}
            className="fixed left-1/2 -translate-x-1/2 z-50 text-sm font-black px-6 py-3 rounded-full whitespace-nowrap"
            style={{ top: 'max(24px, calc(env(safe-area-inset-top) + 8px))', background:'linear-gradient(135deg,#22c55e,#4ade80)', color:'#000', boxShadow:'0 4px 24px rgba(34,197,94,0.5)' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[28px] font-black text-white tracking-tight leading-none">Lift</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-600">{format(new Date(), 'EEEE, MMM d')}</p>
            <button onClick={() => setShowSchedule(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: todayType === 'gym' ? 'rgba(34,197,94,0.15)' : todayType === 'home' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)', color: todayType === 'gym' ? '#22c55e' : todayType === 'home' ? '#60a5fa' : '#6b7280' }}>
              {DAY_LABELS[todayType]} {todayType.charAt(0).toUpperCase()+todayType.slice(1)} Day
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <motion.button whileTap={{ scale:0.92 }} onClick={() => setShowAiChat(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-bold"
            style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', color:'#4ade80' }}>
            🤖
          </motion.button>
          {workoutPlan && (
            <>
              <motion.button whileTap={{ scale:0.92 }} onClick={() => setShowPlanChat(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-bold"
                style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', color:'#4ade80' }}>
                ✏️
              </motion.button>
              <motion.button whileTap={{ scale:0.92 }} onClick={() => setShowAnalysis(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-bold"
                style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)', color:'#a5b4fc' }}>
                🧠
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar — only when there's a plan */}
      {planLifts.length > 0 && (
        <div className="mb-5 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-400">Today's Progress</p>
            <p className="text-xs font-black text-white">{loggedCount} <span className="text-gray-600">/ {planLifts.length}</span></p>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <motion.div className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${planLifts.length ? (loggedCount / planLifts.length) * 100 : 0}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ background: 'linear-gradient(90deg,#22c55e,#4ade80)', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }} />
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search any exercise..."
          className="w-full pl-9 pr-4 py-3 rounded-2xl text-sm text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl overflow-hidden z-20"
              style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
              {searchResults.map((e, i) => {
                const cat = getCategory(e)
                return (
                  <button key={i} onClick={() => { setLogTarget({ exercise: e }); setSearch('') }}
                    className="w-full text-left px-4 py-3 border-b border-white/[0.04] last:border-0 active:bg-white/5 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                    <span className="flex-1 text-sm text-gray-200">{e}</span>
                    <span className="text-[10px] font-bold" style={{ color: cat.color }}>LOG →</span>
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Today's Plan */}
      {planLifts.length > 0 && (
        <section className="mb-6">
          <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-3">Today's Plan</p>
          <div className="space-y-2">
            {planLifts.map((lift, i) => {
              const done = loggedNames.has(lift.exercise)
              return (
                <motion.div key={i} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all"
                  style={{ background: done ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.025)', border: done ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.055)' }}>
                  <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: done ? '#22c55e' : getCategory(lift.exercise).color, boxShadow: `0 0 6px ${done ? '#22c55e' : getCategory(lift.exercise).color}50` }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{lift.exercise}</p>
                      {done && <span className="text-[10px] text-green-400 font-bold shrink-0">✓ Done</span>}
                    </div>
                    {lift.setsReps && <p className="text-xs mt-0.5" style={{ color: getCategory(lift.exercise).color + 'aa' }}>{lift.setsReps}</p>}
                  </div>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={() => setLogTarget({ exercise: lift.exercise, defaultSets: lift.defaultSets, defaultReps: lift.defaultReps })}
                    className="shrink-0 w-14 py-2 rounded-xl text-xs font-black"
                    style={done
                      ? { background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.2)' }
                      : { background: getCategory(lift.exercise).bg, color: getCategory(lift.exercise).color, border:`1px solid ${getCategory(lift.exercise).color}30` }}>
                    {done ? '+1' : 'Log'}
                  </motion.button>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      {/* Previous exercises — grouped by category */}
      {prevExercises.length > 0 && (
        <section className="mb-6">
          <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-3">Previous Exercises</p>
          {Object.entries(
            prevExercises.reduce((acc, ex) => {
              const cat = getCategory(ex)
              if (!acc[cat.label]) acc[cat.label] = { cat, exercises: [] }
              acc[cat.label].exercises.push(ex)
              return acc
            }, {})
          ).map(([catLabel, { cat, exercises }], gi) => (
            <div key={catLabel} className="mb-4 last:mb-0">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cat.color }}>{catLabel}</p>
              </div>
              <div className="space-y-2">
                {exercises.map((ex, i) => (
                  <ExerciseRow key={i} exercise={ex} showPR pr={prs[ex]} delay={(gi * 4 + i) * 0.03}
                    onLog={() => setLogTarget({ exercise: ex })} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Strength chart */}
      {workouts.length > 0 && (
        <div className="card p-4 mb-4">
          <p className="text-sm font-bold text-white mb-3">Strength Progression</p>
          <select value={activeChart} onChange={e => setChartExercise(e.target.value)} className="input-field w-full h-10 text-sm mb-3">
            {[...new Set([...planLifts.map(l => l.exercise), ...workouts.map(w => w.exercise)])].map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData}>
                <defs><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#22c55e"/><stop offset="100%" stopColor="#4ade80"/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                <XAxis dataKey="date" tick={{ fontSize:9, fill:'#4b5563' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:'#4b5563' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#141720', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, color:'#fff', fontSize:12 }} cursor={{ stroke:'rgba(34,197,94,0.2)', strokeWidth:1 }} />
                <Line type="monotone" dataKey="weight" stroke="url(#lg2)" strokeWidth={2.5} dot={{ fill:'#22c55e', r:3, strokeWidth:0 }} activeDot={{ r:5, fill:'#4ade80' }} name="Weight (lbs)" />
                <Line type="monotone" dataKey="oneRM" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Est. 1RM" />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-sm text-gray-600 py-6">No data yet</p>}
        </div>
      )}

      {/* Recent sessions */}
      {recentGroups.length > 0 && (
        <div className="card p-4">
          <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-3">Recent Sessions</p>
          {recentGroups.map(([date, items]) => {
            // Group exercises by muscle category
            const byCategory = {}
            for (const w of items) {
              const cat = getCategory(w.exercise)
              if (!byCategory[cat.label]) byCategory[cat.label] = { cat, entries: [] }
              byCategory[cat.label].entries.push(w)
            }
            return (
              <div key={date} className="mb-5 last:mb-0">
                <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-2">{date}</p>
                {Object.entries(byCategory).map(([catLabel, { cat, entries }]) => (
                  <div key={catLabel} className="mb-3 last:mb-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cat.color }}>{catLabel}</p>
                    </div>
                    {entries.map(w => (
                      <motion.div key={w.id} layout className="flex items-center gap-3 py-2 pl-3 border-b border-white/[0.04] last:border-0">
                        <span className="flex-1 text-sm font-semibold text-gray-200">{w.exercise}</span>
                        <span className="text-xs text-gray-600">{w.weight > 0 ? `${w.weight}lbs × ` : ''}{w.reps} × {w.sets}</span>
                        {prs[w.exercise] === w.weight && w.weight > 0 && <span className="text-[10px] text-amber-400 font-bold">PR</span>}
                        <motion.button whileTap={{ scale:0.8 }} onClick={() => deleteWorkout(w.id)}
                          className="text-gray-700 hover:text-red-400 transition-colors text-lg w-6 text-center">×</motion.button>
                      </motion.div>
                    ))}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {planLifts.length === 0 && workouts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">🏋️</div>
          <p className="text-lg font-black text-white mb-2">No plan yet</p>
          <p className="text-sm text-gray-600">Search for any exercise above to start logging.</p>
        </div>
      )}

      <AnimatePresence>
        {logTarget && <LogModal exercise={logTarget.exercise} defaultSets={logTarget.defaultSets} defaultReps={logTarget.defaultReps} onLog={handleLog} onClose={() => setLogTarget(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showAnalysis && <AnalysisSheet workouts={workouts} workoutPlan={workoutPlan} user={user} onClose={() => setShowAnalysis(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showSchedule && (
          <SchedulePicker
            schedule={gymSchedule}
            onChange={(s) => saveProfile({ gymSchedule: s })}
            onClose={() => setShowSchedule(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPlanChat && (
          <PlanChat
            plan={currentPlan}
            user={user}
            onPlanUpdate={(newPlan) => { setCurrentPlan(newPlan); saveProfile({ workoutPlan: newPlan }) }}
            onClose={() => setShowPlanChat(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAiChat && (
          <AiTipsChat
            user={user}
            todayWorkouts={todayWorkouts}
            todayNutrition={todayNutrition}
            todayFoods={todayFoods}
            foods={foods}
            workouts={workouts}
            weightLogs={weightLogs}
            streak={streak}
            saveProfile={saveProfile}
            onClose={() => setShowAiChat(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
