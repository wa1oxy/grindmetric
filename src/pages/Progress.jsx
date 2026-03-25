import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../contexts/AppContext'
import { analyzeProgressPhoto, compareProgressPhotos } from '../lib/gemini'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Progress() {
  const { photos, addPhoto, updatePhoto, deletePhoto, weightLogs, addWeightLog, user } = useApp()
  const [comparing, setComparing] = useState([])
  const [viewing, setViewing] = useState(null)
  const [aiLoading, setAiLoading] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareFeedback, setCompareFeedback] = useState(null)
  const [weight, setWeight] = useState('')
  const [toast, setToast] = useState(null)
  const fileRef = useRef()

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { addPhoto({ photo_url: ev.target.result, gemini_feedback: null }); showToast('Photo added! 📸') }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleAnalyze = async (photo) => {
    setAiLoading(photo.id)
    const base64 = photo.photo_url?.split(',')[1] || photo.photo_url
    const feedback = await analyzeProgressPhoto(base64)
    updatePhoto(photo.id, { gemini_feedback: feedback })
    setAiLoading(null)
    showToast('Analysis done!')
  }

  const toggleCompare = (id) => {
    setCompareFeedback(null)
    setComparing(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id])
  }

  const handleCompareWithAI = async () => {
    if (comparePhotos.length !== 2) return
    setCompareLoading(true)
    setCompareFeedback(null)
    const [before, after] = comparePhotos
    const feedback = await compareProgressPhotos({
      beforeBase64: before.photo_url?.split(',')[1] || before.photo_url,
      afterBase64: after.photo_url?.split(',')[1] || after.photo_url,
      beforeDate: format(new Date(before.uploaded_at), 'MMM d, yyyy'),
      afterDate: format(new Date(after.uploaded_at), 'MMM d, yyyy'),
      userProfile: user?.profile,
    })
    setCompareFeedback(feedback)
    setCompareLoading(false)
  }

  const logWeight = () => {
    if (!weight) return
    addWeightLog({ weight_kg: parseFloat(weight) })
    setWeight('')
    showToast(`Logged ${weight}kg 💪`)
  }

  const comparePhotos = photos.filter(p => comparing.includes(p.id)).sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at))

  // Weight trend chart
  const weightChartData = weightLogs.slice(0, 14).reverse().map(w => ({
    date: format(new Date(w.created_at), 'MM/dd'),
    weight: w.weight_kg,
  }))

  const latestWeight = weightLogs[0]?.weight_kg
  const prevWeight = weightLogs[1]?.weight_kg
  const weightDiff = latestWeight && prevWeight ? (latestWeight - prevWeight).toFixed(1) : null

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

      <h2 className="text-[28px] font-black text-white mb-5 tracking-tight">Progress</h2>

      {/* Weight card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="section-label mb-0.5">Current Weight</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-white">{latestWeight ? `${latestWeight}kg` : '—'}</p>
              {weightDiff !== null && (
                <span className={`text-sm font-bold ${parseFloat(weightDiff) < 0 ? 'text-brand-400' : 'text-red-400'}`}>
                  {parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff}kg
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)}
              placeholder="kg" className="input-field w-20 h-10 text-center text-sm" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={logWeight} disabled={!weight}
              className="btn-primary px-4 h-10 text-sm disabled:opacity-30">Log</motion.button>
          </div>
        </div>
        {weightChartData.length > 1 && (
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={weightChartData}>
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#4b5563' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#141720', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 11 }} />
              <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2} dot={{ r: 2, fill: '#22c55e', strokeWidth: 0 }} name="kg" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Photo upload */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => fileRef.current.click()}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl mb-4 text-sm font-bold text-white"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.1))', border: '1px solid rgba(139,92,246,0.25)' }}>
        <span className="text-xl">📸</span> Upload Progress Photo
      </motion.button>

      {/* Comparison slider */}
      <AnimatePresence>
        {comparePhotos.length === 2 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="card p-3 mb-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label mb-0">Before / After</p>
              <button onClick={() => { setComparing([]); setCompareFeedback(null) }} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Clear ×</button>
            </div>
            <CompareSlider before={comparePhotos[0]} after={comparePhotos[1]} />
            {/* AI Comparison */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCompareWithAI}
              disabled={compareLoading}
              className="w-full mt-3 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.15))', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
              {compareLoading ? (
                <><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>⚡</motion.span> Analyzing transformation...</>
              ) : '🤖 AI Progress Analysis'}
            </motion.button>
            <AnimatePresence>
              {compareFeedback && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3 rounded-xl text-xs text-gray-300 leading-relaxed"
                  style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  {compareFeedback}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photos grid */}
      {photos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">📷</p>
          <p className="text-sm text-gray-600">Upload progress photos to track changes over time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {photos.map((photo, i) => (
            <motion.div key={photo.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="card overflow-hidden">
              <div className="relative">
                <img src={photo.photo_url} alt="" className="w-full aspect-video object-cover cursor-pointer"
                  onClick={() => setViewing(photo)} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3">
                  <p className="text-xs font-semibold text-white">{format(new Date(photo.uploaded_at), 'EEEE, MMM d yyyy')}</p>
                </div>
                <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleCompare(photo.id)}
                    className="text-xs font-bold px-2.5 py-1.5 rounded-xl"
                    style={comparing.includes(photo.id)
                      ? { background: 'rgba(34,197,94,0.9)', color: '#000' }
                      : { background: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(8px)' }}>
                    {comparing.includes(photo.id) ? '✓ Selected' : 'Compare'}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => deletePhoto(photo.id)}
                    className="text-xs font-bold px-2 py-1.5 rounded-xl text-white"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>×</motion.button>
                </div>
              </div>
              {/* AI section */}
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600">AI Body Analysis</p>
                  <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleAnalyze(photo)}
                    disabled={aiLoading === photo.id}
                    className="text-xs font-bold text-brand-400 disabled:opacity-50 flex items-center gap-1">
                    {aiLoading === photo.id ? (
                      <><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>⚡</motion.span> Analyzing...</>
                    ) : '🤖 Analyze'}
                  </motion.button>
                </div>
                <AnimatePresence>
                  {photo.gemini_feedback && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-gray-400 leading-relaxed mt-2">
                      {photo.gemini_feedback}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Fullscreen viewer - KEEP BELOW */}
      <AnimatePresence>
        {viewing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={() => setViewing(null)}>
            <div className="flex items-center justify-between p-4">
              <p className="text-sm text-white font-semibold">{format(new Date(viewing.uploaded_at), 'EEEE, MMM d yyyy')}</p>
              <button className="text-gray-400 text-2xl">×</button>
            </div>
            <img src={viewing.photo_url} alt="" className="flex-1 object-contain" />
            {viewing.gemini_feedback && (
              <div className="p-4 bg-black/60 backdrop-blur-sm">
                <p className="text-gray-300 text-sm leading-relaxed">{viewing.gemini_feedback}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CompareSlider({ before, after }) {
  const [pos, setPos] = useState(50)
  const containerRef = useRef()
  const dragging = useRef(false)

  const move = useCallback((clientX) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100))
    setPos(pct)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl select-none"
      style={{ aspectRatio: '4/5', cursor: 'ew-resize' }}
      onMouseMove={e => dragging.current && move(e.clientX)}
      onMouseUp={() => { dragging.current = false }}
      onMouseLeave={() => { dragging.current = false }}
      onTouchMove={e => { e.preventDefault(); move(e.touches[0].clientX) }}
      onTouchEnd={() => { dragging.current = false }}
    >
      {/* After (right side) */}
      <img src={after.photo_url} alt="after" className="absolute inset-0 w-full h-full object-cover" draggable={false} />

      {/* Before (clipped left) */}
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before.photo_url} alt="before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      </div>

      {/* Divider line */}
      <div className="absolute inset-y-0 w-0.5 bg-white/90 pointer-events-none" style={{ left: `${pos}%`, transform: 'translateX(-50%)', boxShadow: '0 0 8px rgba(0,0,0,0.6)' }} />

      {/* Drag handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl z-10"
        style={{ left: `${pos}%`, cursor: 'ew-resize' }}
        onMouseDown={e => { dragging.current = true; e.preventDefault() }}
        onTouchStart={() => { dragging.current = true }}
      >
        <span className="text-gray-700 font-black text-sm select-none">⇔</span>
      </div>

      {/* Labels */}
      <div className="absolute bottom-3 left-3 pointer-events-none">
        <span className="text-[10px] font-bold text-white bg-black/55 px-2.5 py-1 rounded-lg backdrop-blur-sm">
          BEFORE · {format(new Date(before.uploaded_at), 'MMM d')}
        </span>
      </div>
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <span className="text-[10px] font-bold text-white bg-black/55 px-2.5 py-1 rounded-lg backdrop-blur-sm">
          AFTER · {format(new Date(after.uploaded_at), 'MMM d')}
        </span>
      </div>
    </div>
  )
}
