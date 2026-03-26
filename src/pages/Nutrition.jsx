import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../contexts/AppContext'
import { parseFoodFromText } from '../lib/gemini'
import { calculateNutritionGoals } from '../lib/nutrition'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format, subDays } from 'date-fns'

async function searchUSDA(query) {
  try {
    const key = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY'
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${key}&pageSize=7&dataType=Survey%20(FNDDS),SR%20Legacy`
    )
    const data = await res.json()
    return (data.foods || []).map(food => {
      const n = food.foodNutrients || []
      const get = (id) => Math.round(n.find(x => x.nutrientId === id)?.value || 0)
      return { food_name: food.description, calories: get(1008), protein_g: get(1003), carbs_g: get(1005), fat_g: get(1004) }
    }).filter(f => f.calories > 0)
  } catch { return [] }
}

const QUICK_FOODS = [
  { food_name: 'Chicken Breast', calories: 187, protein_g: 35, carbs_g: 0,  fat_g: 4,  emoji: '🍗' },
  { food_name: 'White Rice',     calories: 206, protein_g: 4,  carbs_g: 45, fat_g: 0,  emoji: '🍚' },
  { food_name: '2 Eggs',         calories: 140, protein_g: 12, carbs_g: 1,  fat_g: 10, emoji: '🥚' },
  { food_name: 'Oats',           calories: 307, protein_g: 11, carbs_g: 55, fat_g: 5,  emoji: '🥣' },
  { food_name: 'Greek Yogurt',   calories: 100, protein_g: 17, carbs_g: 6,  fat_g: 0,  emoji: '🫙' },
  { food_name: 'Banana',         calories: 105, protein_g: 1,  carbs_g: 27, fat_g: 0,  emoji: '🍌' },
  { food_name: 'Protein Shake',  calories: 150, protein_g: 25, carbs_g: 8,  fat_g: 3,  emoji: '🥤' },
  { food_name: 'Almonds',        calories: 164, protein_g: 6,  carbs_g: 6,  fat_g: 14, emoji: '🥜' },
]

function MacroRing({ value, goal, color, label }) {
  const R = 30, circ = 2 * Math.PI * R
  const pct = Math.min(1, value / goal)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="36" cy="36" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <motion.circle cx="36" cy="36" r={R} fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - pct * circ }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black text-white">{value}</span>
        </div>
      </div>
      <p className="text-[10px] font-semibold text-gray-500">{label}</p>
      <p className="text-[9px] text-gray-700">/{goal}g</p>
    </div>
  )
}

export default function Nutrition() {
  const { foods, addFood, deleteFood, todayFoods, todayNutrition, user } = useApp()
  const goals = user?.profile?.nutritionGoals || calculateNutritionGoals(user?.profile)
  const CALORIE_GOAL = goals.calories
  const PROTEIN_GOAL = goals.protein
  const CARBS_GOAL   = goals.carbs
  const FAT_GOAL     = goals.fat
  const [foodName, setFoodName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs]   = useState('')
  const [fat, setFat]       = useState('')
  const [search, setSearch] = useState('')
  const [toast, setToast]   = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [usdaResults, setUsdaResults] = useState([])
  const [usdaLoading, setUsdaLoading] = useState(false)
  const searchTimer = useRef(null)

  // AI food parsing
  const [aiInput, setAiInput] = useState('')
  const [aiParsing, setAiParsing] = useState(false)
  const [aiResults, setAiResults] = useState(null)
  const [showAiInput, setShowAiInput] = useState(false)

  const handleAiParse = async () => {
    if (!aiInput.trim()) return
    setAiParsing(true)
    setAiResults(null)
    const items = await parseFoodFromText(aiInput, user?.profile)
    setAiResults(items || [])
    setAiParsing(false)
  }

  const confirmAiItems = (items) => {
    items.forEach(f => addFood(f))
    showToast(`Logged ${items.length} item${items.length > 1 ? 's' : ''}!`)
    setAiResults(null)
    setAiInput('')
    setShowAiInput(false)
  }

  const filtered = QUICK_FOODS.filter(f =>
    !search || f.food_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSearchChange = (val) => {
    setSearch(val)
    clearTimeout(searchTimer.current)
    if (val.trim().length < 2) { setUsdaResults([]); return }
    setUsdaLoading(true)
    searchTimer.current = setTimeout(async () => {
      const results = await searchUSDA(val.trim())
      setUsdaResults(results)
      setUsdaLoading(false)
    }, 500)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000) }

  const handleLog = () => {
    if (!foodName || !calories) return
    addFood({ food_name: foodName, calories: parseInt(calories), protein_g: parseInt(protein)||0, carbs_g: parseInt(carbs)||0, fat_g: parseInt(fat)||0 })
    setFoodName(''); setCalories(''); setProtein(''); setCarbs(''); setFat('')
    setShowForm(false)
    showToast('Food logged! 🍽️')
  }

  const quickAdd = (f) => { addFood(f); showToast(`Added ${f.food_name}`) }

  const caloriesPct = Math.min(100, (todayNutrition.calories / CALORIE_GOAL) * 100)
  const calOver = todayNutrition.calories > CALORIE_GOAL

  // 7-day chart
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    const ds = d.toISOString().split('T')[0]
    const cal = foods.filter(f => f.created_at.startsWith(ds)).reduce((s, f) => s + f.calories, 0)
    return { day: format(d, 'EEE'), calories: cal, isToday: i === 6 }
  })

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

      <h2 className="text-[28px] font-black text-white mb-5 tracking-tight">Nutrition</h2>

      {/* Hero calorie bar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-4 mb-4">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="section-label mb-0.5">Today</p>
            <p className="text-3xl font-black text-white">{todayNutrition.calories}
              <span className="text-sm text-gray-600 font-normal ml-1">/ {CALORIE_GOAL} cal</span>
            </p>
          </div>
          <p className={`text-sm font-bold ${calOver ? 'text-red-400' : 'text-brand-400'}`}>
            {calOver ? `${todayNutrition.calories - CALORIE_GOAL} over` : `${CALORIE_GOAL - todayNutrition.calories} left`}
          </p>
        </div>
        <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden mb-5">
          <motion.div className={`h-full rounded-full ${calOver ? 'bg-red-500' : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${caloriesPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={!calOver ? { background: 'linear-gradient(90deg, #22c55e, #4ade80)' } : {}}
          />
        </div>
        {/* Macro rings */}
        <div className="flex justify-around">
          <MacroRing value={todayNutrition.protein} goal={PROTEIN_GOAL} color="#3b82f6" label="Protein" />
          <MacroRing value={todayNutrition.carbs}   goal={CARBS_GOAL}   color="#f59e0b" label="Carbs" />
          <MacroRing value={todayNutrition.fat}     goal={FAT_GOAL}     color="#ef4444" label="Fat" />
        </div>
      </motion.div>

      {/* AI Food Logger */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="card p-4 mb-4 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f1a14 0%, #0f1117 100%)', border: '1px solid rgba(34,197,94,0.15)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center text-sm">🤖</div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Tell AI what you ate</p>
              <p className="text-[10px] text-brand-500 font-semibold">Natural language → macros</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.93 }} onClick={() => { setShowAiInput(v => !v); setAiResults(null) }}
            className="text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ background: showAiInput ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
            {showAiInput ? 'Cancel' : 'Log with AI'}
          </motion.button>
        </div>

        <AnimatePresence>
          {showAiInput && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
              <div className="mt-3 space-y-3">
                <textarea
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  placeholder="e.g. 2 scrambled eggs, a bowl of oatmeal with honey, and a large coffee with oat milk"
                  rows={3}
                  className="input-field w-full text-sm resize-none p-3 leading-relaxed"
                  style={{ minHeight: 80 }}
                />
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleAiParse}
                  disabled={!aiInput.trim() || aiParsing}
                  className="btn-primary w-full py-3 text-sm disabled:opacity-40">
                  {aiParsing ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} className="inline-block">⚡</motion.span>
                      Analyzing...
                    </span>
                  ) : 'Parse My Food'}
                </motion.button>

                <AnimatePresence>
                  {aiResults !== null && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {aiResults.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-3">Couldn't parse that. Try being more specific.</p>
                      ) : (
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Found {aiResults.length} item{aiResults.length > 1 ? 's' : ''} — confirm to log</p>
                          <div className="space-y-1.5 mb-3">
                            {aiResults.map((f, i) => (
                              <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="text-xs font-semibold text-gray-200 truncate">{f.food_name}</p>
                                  <p className="text-[9px] text-gray-600">P:{f.protein_g}g · C:{f.carbs_g}g · F:{f.fat_g}g</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-black text-amber-400">{f.calories}</p>
                                  <p className="text-[9px] text-gray-600">cal</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-white/[0.05] mb-3">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-sm font-black text-amber-400">{aiResults.reduce((s, f) => s + (f.calories || 0), 0)} cal</p>
                          </div>
                          <motion.button whileTap={{ scale: 0.97 }} onClick={() => confirmAiItems(aiResults)}
                            className="btn-primary w-full py-3 text-sm">
                            Log All to Today
                          </motion.button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showAiInput && <p className="text-xs text-gray-600 mt-2">Describe your meal in plain English — AI fills in the calories and macros.</p>}
      </motion.div>

      {/* Search + USDA */}
      <div className="relative mb-3">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
        <input value={search} onChange={e => handleSearchChange(e.target.value)} placeholder="Search foods or USDA database..."
          className="input-field w-full h-11 pl-9 pr-10 text-sm" />
        {(usdaLoading || search) && (
          <button onClick={() => { setSearch(''); setUsdaResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 text-lg">
            {usdaLoading ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} className="inline-block text-brand-500 text-sm">⚡</motion.span> : '×'}
          </button>
        )}
      </div>

      {/* USDA Results */}
      <AnimatePresence>
        {usdaResults.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="card p-2 mb-3">
            <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest px-2 mb-1.5">USDA Results</p>
            {usdaResults.map((f, i) => (
              <motion.button key={i} whileTap={{ scale: 0.98 }}
                onClick={() => { quickAdd(f); setSearch(''); setUsdaResults([]) }}
                className="w-full flex items-center justify-between px-2.5 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors text-left">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-xs font-semibold text-gray-200 truncate">{f.food_name}</p>
                  <p className="text-[9px] text-gray-600">P:{f.protein_g}g · C:{f.carbs_g}g · F:{f.fat_g}g</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-amber-400">{f.calories}</p>
                  <p className="text-[9px] text-gray-600">cal</p>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick-add chips */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {filtered.map((f, i) => (
          <motion.button key={f.food_name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.94 }}
            onClick={() => quickAdd(f)}
            className="flex-none card p-3 text-left min-w-[110px] active:border-brand-500/40 transition-colors"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <p className="text-xl mb-1">{f.emoji}</p>
            <p className="text-xs font-bold text-white leading-tight whitespace-nowrap">{f.food_name}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{f.calories} cal · {f.protein_g}g P</p>
          </motion.button>
        ))}
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => setShowForm(v => !v)}
          className="flex-none flex flex-col items-center justify-center card p-3 min-w-[72px] gap-1"
          style={{ borderColor: showForm ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.06)' }}>
          <span className="text-xl">{showForm ? '✕' : '+'}</span>
          <span className="text-[10px] text-gray-500 font-semibold">Custom</span>
        </motion.button>
      </div>

      {/* Manual form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden mb-4">
            <div className="card p-4">
              <input value={foodName} onChange={e => setFoodName(e.target.value)} placeholder="Food name"
                className="input-field w-full h-11 text-sm mb-3" />
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[['Cal', calories, setCalories], ['Protein', protein, setProtein], ['Carbs', carbs, setCarbs], ['Fat', fat, setFat]].map(([l, v, s]) => (
                  <div key={l}>
                    <p className="text-[9px] text-gray-600 font-bold uppercase mb-1">{l}</p>
                    <input type="number" inputMode="numeric" value={v} onChange={e => s(e.target.value)} placeholder="0"
                      className="input-field w-full h-10 text-center text-sm font-bold" />
                  </div>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleLog} disabled={!foodName || !calories}
                className="btn-primary w-full py-3 text-sm disabled:opacity-30">
                Log Food
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7-day bar chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="card p-4 mb-4">
        <p className="section-label">7-Day Calories</p>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={weeklyData} barSize={20}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4b5563' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#141720', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff', fontSize: 12 }} />
            <Bar dataKey="calories" radius={[6, 6, 0, 0]} name="Calories">
              {weeklyData.map((d, i) => (
                <Cell key={i} fill={d.isToday ? '#22c55e' : '#1a1f2e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Today's log */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label mb-0">Today's Log</p>
          <p className="text-xs font-bold text-brand-400">{todayFoods.length} items</p>
        </div>
        {todayFoods.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-5">Nothing logged yet.</p>
        ) : (
          <div className="space-y-0.5">
            {todayFoods.map(f => (
              <motion.div key={f.id} layout
                className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-sm shrink-0">
                  {QUICK_FOODS.find(q => q.food_name === f.food_name)?.emoji || '🍽️'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-200 truncate">{f.food_name}</p>
                  <p className="text-[10px] text-gray-600">P:{f.protein_g}g C:{f.carbs_g}g F:{f.fat_g}g</p>
                </div>
                <span className="text-sm font-bold text-amber-400">{f.calories}</span>
                <span className="text-[10px] text-gray-600 mr-1">cal</span>
                <motion.button whileTap={{ scale: 0.8 }} onClick={() => deleteFood(f.id)}
                  className="text-gray-700 hover:text-red-400 transition-colors text-lg w-6 text-center">×</motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
