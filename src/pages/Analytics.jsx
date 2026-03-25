import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../contexts/AppContext'
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts'
import { format, subDays } from 'date-fns'

const CHART_TABS = [
  { id: 'Strength', emoji: '📈' },
  { id: 'Calories', emoji: '🔥' },
  { id: 'Volume',   emoji: '📦' },
  { id: 'Heatmap',  emoji: '📅' },
  { id: 'Radar',    emoji: '🕸️' },
  { id: 'Muscles',  emoji: '🫀' },
]

const MUSCLE_MAP = {
  upper_chest: { label: 'Upper Chest', exercises: ['Incline', 'Upper Chest', 'Low Cable Fly'] },
  lower_chest: { label: 'Lower Chest', exercises: ['Bench', 'Dip', 'Decline', 'Chest Fly', 'Chest Press', 'Push-up'] },
  back:        { label: 'Back',        exercises: ['Deadlift', 'Row', 'Pull-up', 'Lat Pull', 'Cable Row', 'Pull Down'] },
  shoulders:   { label: 'Shoulders',   exercises: ['OHP', 'Overhead', 'Lateral Raise', 'Shoulder Press', 'Face Pull', 'Arnold'] },
  arms:        { label: 'Arms',        exercises: ['Curl', 'Tricep', 'Hammer', 'Extension', 'Pushdown', 'Skullcrusher'] },
  core:        { label: 'Core',        exercises: ['Plank', 'Crunch', 'Sit-up', 'Ab Wheel', 'Leg Raise', 'Cable Crunch'] },
  legs:        { label: 'Legs',        exercises: ['Squat', 'Lunge', 'RDL', 'Leg Press', 'Leg Extension', 'Leg Curl', 'Split Squat', 'Bulgarian'] },
  glutes:      { label: 'Glutes',      exercises: ['Hip Thrust', 'Glute Bridge', 'Sumo', 'Cable Kickback'] },
  calves:      { label: 'Calves',      exercises: ['Calf Raise', 'Jump Rope', 'Box Jump'] },
}

export default function Analytics() {
  const { workouts, foods, weightLogs } = useApp()
  const [chartTab, setChartTab] = useState('Strength')
  const [exercise, setExercise] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState(null)

  const exercises = [...new Set(workouts.map(w => w.exercise))]
  const activeEx = exercise || exercises[0] || 'Bench Press'

  const strengthData = workouts.filter(w => w.exercise === activeEx)
    .map(w => ({ date: format(new Date(w.created_at), 'MM/dd'), weight: w.weight }))
    .reverse().slice(-20)

  const calorieData = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), 13 - i)
    const ds = d.toISOString().split('T')[0]
    const cal = foods.filter(f => f.created_at.startsWith(ds)).reduce((s, f) => s + f.calories, 0)
    return { day: format(d, 'MM/dd'), calories: cal, isToday: i === 13 }
  })

  const volumeMap = new Map()
  for (const w of workouts) {
    const d = format(new Date(w.created_at), 'MM/dd')
    volumeMap.set(d, (volumeMap.get(d) || 0) + w.weight * w.reps * w.sets)
  }
  const volumeData = [...volumeMap.entries()].map(([day, volume]) => ({ day, volume })).reverse().slice(-10)

  const workoutDays = new Set(workouts.map(w => w.created_at.split('T')[0]))
  const last63 = Array.from({ length: 63 }, (_, i) => {
    const d = subDays(new Date(), 62 - i)
    return { date: d.toISOString().split('T')[0], active: workoutDays.has(d.toISOString().split('T')[0]) }
  })

  const last30 = workouts.filter(w => new Date(w.created_at) > subDays(new Date(), 30)).length
  const maxWeight = workouts.length ? Math.max(...workouts.map(w => w.weight)) : 0
  const avgCal = foods.length ? foods.slice(0,30).reduce((s,f) => s + f.calories, 0) / Math.min(30, foods.length) : 0
  const radarData = [
    { metric: 'Consistency', value: Math.round(Math.min(100, last30 / 30 * 100)) },
    { metric: 'Strength',    value: Math.round(Math.min(100, maxWeight / 4)) },
    { metric: 'Volume',      value: Math.round(Math.min(100, workouts.length * 3)) },
    { metric: 'Nutrition',   value: Math.round(Math.min(100, avgCal / 2200 * 100)) },
    { metric: 'Progress',    value: weightLogs.length >= 2 ? 70 : 40 },
  ]

  const muscleSets = {}
  for (const w of workouts) {
    for (const [key, { exercises: exs }] of Object.entries(MUSCLE_MAP)) {
      if (exs.some(e => w.exercise.toLowerCase().includes(e.toLowerCase()))) {
        muscleSets[key] = (muscleSets[key] || 0) + w.sets
      }
    }
  }

  const tooltipStyle = { background: '#141720', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff', fontSize: 12 }

  return (
    <div className="tab-page">
      <h2 className="text-[28px] font-black text-white mb-5 tracking-tight">Stats</h2>

      {/* Tab selector - scrollable pill row */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
        {CHART_TABS.map(t => (
          <motion.button key={t.id} whileTap={{ scale: 0.93 }} onClick={() => setChartTab(t.id)}
            className={`flex-none flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200`}
            style={chartTab === t.id ? {
              background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(74,222,128,0.1))',
              border: '1px solid rgba(34,197,94,0.35)',
              color: '#4ade80',
            } : {
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#4b5563',
            }}
          >
            {t.emoji} {t.id}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={chartTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }} className="card p-4">

          {chartTab === 'Strength' && (
            <>
              <select value={activeEx} onChange={e => setExercise(e.target.value)}
                className="input-field w-full h-10 text-sm mb-4">
                {exercises.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              {strengthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={strengthData}>
                    <defs>
                      <linearGradient id="sg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#4ade80" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(34,197,94,0.15)', strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="weight" stroke="url(#sg)" strokeWidth={2.5}
                      dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#4ade80' }} name="Weight (lbs)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-600 text-sm py-12">Log workouts to see progression</p>
              )}
            </>
          )}

          {chartTab === 'Calories' && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={calorieData} barSize={16}>
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="calories" radius={[6, 6, 0, 0]} name="Calories">
                  {calorieData.map((d, i) => <Cell key={i} fill={d.isToday ? '#22c55e' : '#1a1f2e'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartTab === 'Volume' && (
            volumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(96,165,250,0.15)', strokeWidth: 1 }}
                    formatter={(v) => [v.toLocaleString(), 'Volume (lbs)']} />
                  <Line type="monotone" dataKey="volume" stroke="#60a5fa" strokeWidth={2.5}
                    dot={{ fill: '#60a5fa', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-600 text-sm py-12">Log workouts to see volume trends</p>
          )}

          {chartTab === 'Heatmap' && (
            <div>
              <div className="flex justify-between text-[10px] text-gray-600 mb-2 px-0.5">
                <span>63 days ago</span><span>Today</span>
              </div>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(9, 1fr)' }}>
                {last63.map(({ date, active }, i) => (
                  <motion.div key={date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.005 }}
                    title={date} className="aspect-square rounded-md"
                    style={{
                      background: active ? 'linear-gradient(135deg, #16a34a, #4ade80)' : 'rgba(255,255,255,0.04)',
                      boxShadow: active ? '0 0 6px rgba(34,197,94,0.4)' : 'none',
                    }} />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 justify-end">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(255,255,255,0.04)' }} />
                <span className="text-[10px] text-gray-600">Rest</span>
                <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #16a34a, #4ade80)' }} />
                <span className="text-[10px] text-gray-600">Workout</span>
              </div>
            </div>
          )}

          {chartTab === 'Radar' && (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Radar name="You" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {radarData.map(d => (
                  <div key={d.metric} className="text-center">
                    <p className="text-base font-black text-brand-400">{d.value}</p>
                    <p className="text-[9px] text-gray-600">{d.metric}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {chartTab === 'Muscles' && (
            <div>
              <MuscleSVG muscleSets={muscleSets} selected={selectedMuscle} onSelect={setSelectedMuscle} />
              <AnimatePresence>
                {selectedMuscle && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-white capitalize">{MUSCLE_MAP[selectedMuscle].label}</p>
                      <p className="text-xs font-bold text-brand-400">{muscleSets[selectedMuscle] || 0} sets</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {MUSCLE_MAP[selectedMuscle].exercises.map(e => (
                        <span key={e} className="text-xs bg-brand-500/15 text-brand-300 px-2.5 py-1 rounded-lg font-semibold">{e}</span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function MuscleSVG({ muscleSets, onSelect, selected }) {
  const maxSets = Math.max(1, ...Object.values(muscleSets))

  function mp(key) {
    const sets = muscleSets[key] || 0
    const isSel = selected === key
    const intensity = sets > 0 ? 0.3 + (sets / maxSets) * 0.6 : 0
    return {
      fill: isSel ? '#22c55e' : sets > 0 ? `rgba(34,197,94,${intensity})` : 'rgba(255,255,255,0.07)',
      stroke: isSel ? '#4ade80' : sets > 0 ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.11)',
      strokeWidth: isSel ? 1.2 : 0.6,
      onClick: () => onSelect(selected === key ? null : key),
      cursor: 'pointer',
      style: {
        filter: isSel ? 'drop-shadow(0 0 5px rgba(34,197,94,0.9))' : sets > 0 ? 'drop-shadow(0 0 2px rgba(34,197,94,0.4))' : 'none',
        transition: 'all 0.12s ease',
      },
    }
  }

  // Non-interactive base style (skin/bone structures)
  const B = { fill: 'rgba(80,88,110,0.32)', stroke: 'rgba(255,255,255,0.1)', strokeWidth: 0.55, style: { pointerEvents: 'none' } }
  // Silhouette base
  const SIL = { fill: 'rgba(50,56,78,0.6)', stroke: 'rgba(255,255,255,0.09)', strokeWidth: 0.5, style: { pointerEvents: 'none' } }

  const MUSCLES = Object.entries(MUSCLE_MAP).map(([key, { label }]) => ({
    key, label, sets: muscleSets[key] || 0,
  }))

  return (
    <div>
      <div className="flex mb-1.5">
        <span className="flex-1 text-center text-[9px] font-bold text-gray-600 uppercase tracking-widest">Front</span>
        <span className="flex-1 text-center text-[9px] font-bold text-gray-600 uppercase tracking-widest">Back</span>
      </div>

      <svg viewBox="0 0 320 470" className="w-full" style={{ maxHeight: 520 }}>

        {/* ════════════════════════════════════════
             FRONT VIEW  (x=0-160, center=80)
             ════════════════════════════════════════ */}
        <g>
          {/* ─── SILHOUETTE BASE ─── */}
          <ellipse cx="80" cy="22" rx="14" ry="17" {...SIL}/>
          <rect x="75" y="38" width="10" height="14" rx="3" {...SIL}/>
          {/* torso */}
          <path d="M75,51 C57,53 36,62 24,75 C17,82 16,96 19,110 C22,122 32,128 44,126
                   L44,145 C36,154 33,168 33,184 C33,196 36,206 40,212
                   L40,218 48,218 48,232 112,232 112,218 120,218
                   C124,212 127,200 127,186 C127,170 124,156 116,147
                   L116,128 C128,126 138,120 141,108 C144,94 142,80 135,73
                   C122,60 103,53 85,51 Z" {...SIL}/>
          {/* left arm */}
          <path d="M24,74 C14,82 10,98 10,116 C10,132 15,148 24,156
                   L23,175 17,194 30,194 C31,178 32,162 32,148
                   C40,140 44,126 44,112 C44,96 40,82 34,74 Z" {...SIL}/>
          {/* right arm */}
          <path d="M136,74 C146,82 150,98 150,116 C150,132 145,148 136,156
                   L137,175 143,194 130,194 C129,178 128,162 128,148
                   C120,140 116,126 116,112 C116,96 120,82 126,74 Z" {...SIL}/>
          {/* left thigh */}
          <path d="M40,230 C34,248 32,278 34,310 C36,328 44,340 54,340
                   L54,352 70,352 70,340 C78,336 82,322 81,296
                   C80,266 76,238 68,230 Z" {...SIL}/>
          {/* right thigh */}
          <path d="M120,230 C126,248 128,278 126,310 C124,328 116,340 106,340
                   L106,352 90,352 90,340 C82,336 78,322 79,296
                   C80,266 84,238 92,230 Z" {...SIL}/>
          {/* left lower leg */}
          <path d="M50,352 C44,368 42,392 45,414 C47,426 54,432 62,432
                   L70,432 C76,428 78,416 76,402 C74,384 70,364 64,352 Z" {...SIL}/>
          {/* right lower leg */}
          <path d="M110,352 C116,368 118,392 115,414 C113,426 106,432 98,432
                   L90,432 C84,428 82,416 84,402 C86,384 90,364 96,352 Z" {...SIL}/>

          {/* ─── HEAD / NECK / CLAVICLES ─── */}
          <ellipse cx="80" cy="22" rx="13" ry="16" {...B}/>
          <rect x="76" y="38" width="8" height="14" rx="2" {...B}/>
          <path d="M76,50 C68,50 52,56 32,68 L34,74 C52,62 68,56 76,56 Z" {...B}/>
          <path d="M84,50 C92,50 108,56 128,68 L126,74 C108,62 92,56 84,56 Z" {...B}/>
          <line x1="80" y1="56" x2="80" y2="138" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" style={{pointerEvents:'none'}}/>
          <line x1="80" y1="138" x2="80" y2="198" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" style={{pointerEvents:'none'}}/>

          {/* ─── ANTERIOR DELTOID ─── */}
          <path d="M22,68 C13,77 9,94 10,112 C11,126 20,136 30,134
                   C37,132 41,122 40,108 C39,92 34,76 28,69 Z" {...mp('shoulders')}/>
          <path d="M138,68 C147,77 151,94 150,112 C149,126 140,136 130,134
                   C123,132 119,122 120,108 C121,92 126,76 132,69 Z" {...mp('shoulders')}/>
          {/* upper trap slope front visible */}
          <path d="M76,42 C66,44 50,54 32,68 L32,74 C50,60 66,52 76,48 Z" {...mp('shoulders')}/>
          <path d="M84,42 C94,44 110,54 128,68 L128,74 C110,60 94,52 84,48 Z" {...mp('shoulders')}/>

          {/* ─── UPPER PECTORALIS (clavicular) ─── */}
          <path d="M28,70 C24,82 24,100 29,114 C33,124 44,130 56,130
                   C66,130 74,126 78,116 L78,58
                   C66,56 44,58 28,70 Z" {...mp('upper_chest')}/>
          <path d="M132,70 C136,82 136,100 131,114 C127,124 116,130 104,130
                   C94,130 86,126 82,116 L82,58
                   C94,56 116,58 132,70 Z" {...mp('upper_chest')}/>

          {/* ─── LOWER PECTORALIS (sternal) ─── */}
          <path d="M26,110 C22,124 24,142 32,152 C38,160 51,163 63,157
                   C71,152 77,140 78,126 L78,116
                   C74,126 66,130 56,130 C44,130 32,122 26,110 Z" {...mp('lower_chest')}/>
          <path d="M134,110 C138,124 136,142 128,152 C122,160 109,163 97,157
                   C89,152 83,140 82,126 L82,116
                   C86,126 94,130 104,130 C116,130 128,122 134,110 Z" {...mp('lower_chest')}/>

          {/* ─── SERRATUS ANTERIOR ─── */}
          <path d="M26,114 C21,122 22,132 28,133 C31,133 32,129 30,124 Z" {...mp('core')}/>
          <path d="M24,132 C19,142 20,153 26,155 C29,154 30,150 28,144 Z" {...mp('core')}/>
          <path d="M23,153 C18,164 20,175 26,177 C29,176 30,172 28,165 Z" {...mp('core')}/>
          <path d="M134,114 C139,122 138,132 132,133 C129,133 128,129 130,124 Z" {...mp('core')}/>
          <path d="M136,132 C141,142 140,153 134,155 C131,154 130,150 132,144 Z" {...mp('core')}/>
          <path d="M137,153 C142,164 140,175 134,177 C131,176 130,172 132,165 Z" {...mp('core')}/>

          {/* ─── BICEPS BRACHII ─── */}
          <path d="M12,72 C7,84 6,104 8,122 C10,136 18,148 27,146
                   C33,144 37,134 36,120 C35,104 30,86 24,74 Z" {...mp('arms')}/>
          <path d="M148,72 C153,84 154,104 152,122 C150,136 142,148 133,146
                   C127,144 123,134 124,120 C125,104 130,86 136,74 Z" {...mp('arms')}/>

          {/* ─── BRACHIALIS (outer lower arm visible) ─── */}
          <path d="M9,116 C6,128 6,142 10,152 C12,158 18,161 23,158
                   C21,146 16,130 13,116 Z" {...mp('arms')}/>
          <path d="M151,116 C154,128 154,142 150,152 C148,158 142,161 137,158
                   C139,146 144,130 147,116 Z" {...mp('arms')}/>

          {/* ─── FOREARMS ─── */}
          <path d="M10,152 C6,166 6,184 9,198 C11,208 19,214 26,212
                   C32,210 34,198 32,184 C30,168 24,155 18,153 Z" {...mp('arms')}/>
          <path d="M150,152 C154,166 154,184 151,198 C149,208 141,214 134,212
                   C128,210 126,198 128,184 C130,168 136,155 142,153 Z" {...mp('arms')}/>
          <ellipse cx="20" cy="215" rx="8" ry="5" {...B}/>
          <ellipse cx="140" cy="215" rx="8" ry="5" {...B}/>

          {/* ─── ABS (6 blocks) ─── */}
          <rect x="61" y="140" width="17" height="17" rx="4" {...mp('core')}/>
          <rect x="82" y="140" width="17" height="17" rx="4" {...mp('core')}/>
          <rect x="61" y="161" width="17" height="17" rx="4" {...mp('core')}/>
          <rect x="82" y="161" width="17" height="17" rx="4" {...mp('core')}/>
          <rect x="61" y="182" width="17" height="15" rx="4" {...mp('core')}/>
          <rect x="82" y="182" width="17" height="15" rx="4" {...mp('core')}/>

          {/* ─── OBLIQUES ─── */}
          <path d="M33,136 C28,152 27,174 31,194 C34,205 43,210 51,206
                   C52,190 50,166 46,148 Z" {...mp('core')}/>
          <path d="M127,136 C132,152 133,174 129,194 C126,205 117,210 109,206
                   C108,190 110,166 114,148 Z" {...mp('core')}/>

          {/* ─── PELVIS / HIP ─── */}
          <path d="M34,208 C29,218 30,230 35,236 L125,236
                   C130,230 131,218 126,208 C108,204 52,204 34,208 Z" {...B}/>

          {/* ─── QUADRICEPS ─── */}
          {/* left vastus lateralis */}
          <path d="M38,232 C32,252 30,284 33,314 C35,330 44,340 54,338
                   C56,320 55,290 54,260 C53,240 47,230 42,232 Z" {...mp('legs')}/>
          {/* left rectus femoris */}
          <path d="M54,230 C49,254 48,288 50,320 C52,338 61,350 70,348
                   C74,344 76,330 74,304 C72,276 68,250 62,232 Z" {...mp('legs')}/>
          {/* left vastus medialis (teardrop) */}
          <path d="M68,280 C62,296 62,316 69,328 C74,338 83,338 87,328
                   C86,310 81,292 75,281 Z" {...mp('legs')}/>
          {/* right vastus lateralis */}
          <path d="M122,232 C128,252 130,284 127,314 C125,330 116,340 106,338
                   C104,320 105,290 106,260 C107,240 113,230 118,232 Z" {...mp('legs')}/>
          {/* right rectus femoris */}
          <path d="M106,230 C111,254 112,288 110,320 C108,338 99,350 90,348
                   C86,344 84,330 86,304 C88,276 92,250 98,232 Z" {...mp('legs')}/>
          {/* right vastus medialis (teardrop) */}
          <path d="M92,280 C98,296 98,316 91,328 C86,338 77,338 73,328
                   C74,310 79,292 85,281 Z" {...mp('legs')}/>

          {/* kneecaps */}
          <ellipse cx="55" cy="346" rx="17" ry="9" {...B}/>
          <ellipse cx="105" cy="346" rx="17" ry="9" {...B}/>

          {/* ─── TIBIALIS ANTERIOR ─── */}
          <path d="M40,354 C35,372 34,396 38,416 C40,428 49,432 56,428
                   C57,415 56,392 54,372 Z" {...mp('legs')}/>
          <path d="M120,354 C125,372 126,396 122,416 C120,428 111,432 104,428
                   C103,415 104,392 106,372 Z" {...mp('legs')}/>

          {/* ─── GASTROCNEMIUS MEDIAL (visible from front) ─── */}
          <path d="M72,354 C68,372 68,394 74,408 C78,418 86,422 90,418
                   C91,406 90,384 85,366 Z" {...mp('calves')}/>
          <path d="M88,354 C92,372 92,394 86,408 C82,418 74,422 70,418
                   C69,406 70,384 75,366 Z" {...mp('calves')}/>

          {/* feet */}
          <path d="M34,428 C30,438 34,446 52,448 C62,448 74,448 76,438 L74,428 Z" {...B}/>
          <path d="M126,428 C130,438 126,446 108,448 C98,448 86,448 84,438 L86,428 Z" {...B}/>
        </g>

        {/* Panel divider */}
        <line x1="160" y1="0" x2="160" y2="470" stroke="rgba(255,255,255,0.05)" strokeWidth="1" style={{pointerEvents:'none'}}/>

        {/* ════════════════════════════════════════
             BACK VIEW  (translate 160, center=80)
             ════════════════════════════════════════ */}
        <g transform="translate(160,0)">
          {/* ─── SILHOUETTE BASE ─── */}
          <ellipse cx="80" cy="22" rx="14" ry="17" {...SIL}/>
          <rect x="75" y="38" width="10" height="14" rx="3" {...SIL}/>
          <path d="M75,51 C57,53 36,62 24,75 C17,82 16,96 19,110 C22,122 32,128 44,126
                   L44,145 C36,154 33,168 33,184 C33,196 36,206 40,212
                   L40,218 48,218 48,232 112,232 112,218 120,218
                   C124,212 127,200 127,186 C127,170 124,156 116,147
                   L116,128 C128,126 138,120 141,108 C144,94 142,80 135,73
                   C122,60 103,53 85,51 Z" {...SIL}/>
          <path d="M24,74 C14,82 10,98 10,116 C10,132 15,148 24,156
                   L23,175 17,194 30,194 C31,178 32,162 32,148
                   C40,140 44,126 44,112 C44,96 40,82 34,74 Z" {...SIL}/>
          <path d="M136,74 C146,82 150,98 150,116 C150,132 145,148 136,156
                   L137,175 143,194 130,194 C129,178 128,162 128,148
                   C120,140 116,126 116,112 C116,96 120,82 126,74 Z" {...SIL}/>
          <path d="M40,230 C34,248 32,278 34,310 C36,328 44,340 54,340
                   L54,352 70,352 70,340 C78,336 82,322 81,296
                   C80,266 76,238 68,230 Z" {...SIL}/>
          <path d="M120,230 C126,248 128,278 126,310 C124,328 116,340 106,340
                   L106,352 90,352 90,340 C82,336 78,322 79,296
                   C80,266 84,238 92,230 Z" {...SIL}/>
          <path d="M50,352 C44,368 42,392 45,414 C47,426 54,432 62,432
                   L70,432 C76,428 78,416 76,402 C74,384 70,364 64,352 Z" {...SIL}/>
          <path d="M110,352 C116,368 118,392 115,414 C113,426 106,432 98,432
                   L90,432 C84,428 82,416 84,402 C86,384 90,364 96,352 Z" {...SIL}/>

          {/* ─── HEAD / NECK ─── */}
          <ellipse cx="80" cy="22" rx="13" ry="16" {...B}/>
          <rect x="76" y="38" width="8" height="14" rx="2" {...B}/>
          <line x1="80" y1="52" x2="80" y2="200" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" style={{pointerEvents:'none'}}/>

          {/* ─── UPPER TRAPEZIUS – tight slopes from neck ─── */}
          <path d="M76,42 C66,44 50,54 33,67 L33,74 C50,60 66,52 76,50 Z" {...mp('shoulders')}/>
          <path d="M84,42 C94,44 110,54 127,67 L127,74 C110,60 94,52 84,50 Z" {...mp('shoulders')}/>

          {/* ─── REAR DELTOID – capped at arm boundary ─── */}
          <path d="M24,68 C16,78 13,96 14,114 C15,128 24,137 34,135
                   C40,133 43,122 42,108 C41,93 36,77 30,69 Z" {...mp('shoulders')}/>
          <path d="M136,68 C144,78 147,96 146,114 C145,128 136,137 126,135
                   C120,133 117,122 118,108 C119,93 124,77 130,69 Z" {...mp('shoulders')}/>

          {/* ─── INFRASPINATUS / MID-TRAP (scapula) ─── */}
          <path d="M31,80 C26,94 26,114 33,126 C39,134 51,136 61,130
                   C66,124 68,112 65,100 C61,88 50,80 39,80 Z" {...mp('back')}/>
          <path d="M129,80 C134,94 134,114 127,126 C121,134 109,136 99,130
                   C94,124 92,112 95,100 C99,88 110,80 121,80 Z" {...mp('back')}/>
          {/* rhomboids / center */}
          <path d="M61,76 C57,92 56,114 61,128 C66,137 76,139 84,132
                   C88,122 88,102 84,90 C80,80 67,74 61,76 Z" {...mp('back')}/>

          {/* ─── TERES MAJOR ─── */}
          <path d="M29,118 C25,134 25,156 33,172 C39,182 50,185 59,178
                   C62,166 61,146 56,130 Z" {...mp('back')}/>
          <path d="M131,118 C135,134 135,156 127,172 C121,182 110,185 101,178
                   C98,166 99,146 104,130 Z" {...mp('back')}/>

          {/* ─── LATISSIMUS DORSI – contained within torso ─── */}
          <path d="M34,86 C30,108 29,150 32,182 C34,198 44,208 60,206
                   C55,184 45,154 38,124 C36,108 34,96 34,86 Z" {...mp('back')}/>
          <path d="M126,86 C130,108 131,150 128,182 C126,198 116,208 100,206
                   C105,184 115,154 122,124 C124,108 126,96 126,86 Z" {...mp('back')}/>

          {/* ─── LOWER TRAPEZIUS ─── */}
          <path d="M31,122 C27,138 31,157 45,169 C54,176 66,174 72,165
                   C70,152 66,138 67,129 C58,133 42,131 31,122 Z" {...mp('back')}/>
          <path d="M129,122 C133,138 129,157 115,169 C106,176 94,174 88,165
                   C90,152 94,138 93,129 C102,133 118,131 129,122 Z" {...mp('back')}/>

          {/* ─── ERECTOR SPINAE ─── */}
          <path d="M69,110 C66,134 66,162 70,188 C72,198 77,200 79,196
                   L79,110 C77,106 71,106 69,110 Z" {...mp('back')}/>
          <path d="M91,110 C94,134 94,162 90,188 C88,198 83,200 81,196
                   L81,110 C83,106 89,106 91,110 Z" {...mp('back')}/>

          {/* ─── TRICEPS – fully within arm silhouette ─── */}
          {/* left long head */}
          <path d="M29,72 C22,88 18,114 20,138 C22,154 31,162 41,159
                   C44,147 43,122 39,100 C35,82 32,76 29,72 Z" {...mp('arms')}/>
          {/* right long head */}
          <path d="M131,72 C138,88 142,114 140,138 C138,154 129,162 119,159
                   C116,147 117,122 121,100 C125,82 128,76 131,72 Z" {...mp('arms')}/>
          {/* left lateral head (outer edge of arm) */}
          <path d="M15,82 C12,98 12,118 17,136 C19,145 26,149 32,147
                   C30,131 25,112 20,97 Z" {...mp('arms')}/>
          {/* right lateral head */}
          <path d="M145,82 C148,98 148,118 143,136 C141,145 134,149 128,147
                   C130,131 135,112 140,97 Z" {...mp('arms')}/>

          {/* ─── FOREARM EXTENSORS ─── */}
          <path d="M20,150 C15,164 14,184 17,200 C19,210 27,215 34,212
                   C35,199 33,179 28,163 Z" {...mp('arms')}/>
          <path d="M140,150 C145,164 146,184 143,200 C141,210 133,215 126,212
                   C125,199 127,179 132,163 Z" {...mp('arms')}/>
          <ellipse cx="25" cy="215" rx="8" ry="5" {...B}/>
          <ellipse cx="135" cy="215" rx="8" ry="5" {...B}/>

          {/* ─── PELVIS / HIP ─── */}
          <path d="M38,208 C33,218 34,230 39,236 L121,236
                   C126,230 127,218 122,208 C106,204 54,204 38,208 Z" {...B}/>

          {/* ─── GLUTEUS MEDIUS – within hip width ─── */}
          <path d="M40,212 C34,225 32,246 40,263 C46,275 60,279 72,272
                   C77,264 79,250 74,234 C69,218 56,210 40,212 Z" {...mp('glutes')}/>
          <path d="M120,212 C126,225 128,246 120,263 C114,275 100,279 88,272
                   C83,264 81,250 86,234 C91,218 104,210 120,212 Z" {...mp('glutes')}/>

          {/* ─── GLUTEUS MAXIMUS – rounded, within thigh width ─── */}
          <path d="M38,254 C33,274 33,302 40,324 C47,342 62,349 76,343
                   C82,334 85,316 82,294 C79,270 66,252 51,254 Z" {...mp('glutes')}/>
          <path d="M122,254 C127,274 127,302 120,324 C113,342 98,349 84,343
                   C78,334 75,316 78,294 C81,270 94,252 109,254 Z" {...mp('glutes')}/>

          {/* ─── HAMSTRINGS – within left thigh (x=40-72), right thigh (x=88-120) ─── */}
          {/* left biceps femoris (outer) */}
          <path d="M42,300 C37,320 36,350 39,376 C41,394 51,403 61,399
                   C65,384 64,356 61,328 C58,304 51,298 46,300 Z" {...mp('legs')}/>
          {/* left semitendinosus (inner) */}
          <path d="M62,302 C58,322 57,352 60,378 C62,396 71,404 79,400
                   C82,385 81,357 78,330 C75,305 69,299 64,301 Z" {...mp('legs')}/>
          {/* right biceps femoris */}
          <path d="M118,300 C123,320 124,350 121,376 C119,394 109,403 99,399
                   C95,384 96,356 99,328 C102,304 109,298 114,300 Z" {...mp('legs')}/>
          {/* right semitendinosus */}
          <path d="M98,302 C102,322 103,352 100,378 C98,396 89,404 81,400
                   C78,385 79,357 82,330 C85,305 91,299 96,301 Z" {...mp('legs')}/>

          {/* knee backs */}
          <ellipse cx="52" cy="402" rx="15" ry="7" {...B}/>
          <ellipse cx="108" cy="402" rx="15" ry="7" {...B}/>

          {/* ─── GASTROCNEMIUS – 2 diamond heads per calf ─── */}
          {/* left calf: x=50-70 */}
          {/* lateral head (outer) */}
          <path d="M44,408 C39,424 39,444 46,458 C50,465 58,467 63,461
                   C64,447 63,427 58,413 Z" {...mp('calves')}/>
          {/* medial head (inner) */}
          <path d="M64,408 C60,424 60,444 66,457 C70,465 77,466 81,460
                   C82,446 80,426 74,412 Z" {...mp('calves')}/>
          {/* right calf: x=90-110 */}
          {/* medial head */}
          <path d="M96,408 C100,424 100,444 94,457 C90,465 83,466 79,460
                   C78,446 80,426 86,412 Z" {...mp('calves')}/>
          {/* lateral head */}
          <path d="M116,408 C121,424 121,444 114,458 C110,465 102,467 97,461
                   C96,447 97,427 102,413 Z" {...mp('calves')}/>

          {/* feet */}
          <path d="M38,460 C34,470 38,470 64,470 L64,460 Z" {...B}/>
          <path d="M122,460 C126,470 122,470 96,470 L96,460 Z" {...B}/>
        </g>
      </svg>

      {/* Muscle legend */}
      <div className="grid grid-cols-3 gap-1.5 mt-3">
        {MUSCLES.map(({ key, label, sets }) => {
          const intensity = sets > 0 ? 0.25 + (sets / maxSets) * 0.65 : 0
          const isSel = selected === key
          return (
            <button key={key} onClick={() => onSelect(selected === key ? null : key)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl transition-all text-left"
              style={{
                background: isSel ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isSel ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{ background: sets > 0 ? `rgba(34,197,94,${intensity + 0.2})` : 'rgba(255,255,255,0.15)' }} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-300 leading-none">{label}</p>
                <p className="text-[9px] text-gray-600 mt-0.5">{sets > 0 ? `${sets} sets` : '—'}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
