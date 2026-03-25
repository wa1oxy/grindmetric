import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signup, login, hasAnyUsers } from '../lib/auth'
import { generateWorkoutPlan } from '../lib/gemini'
import { inviteCodes } from '../lib/inviteCodes'

const GOALS = [
  { id: 'lose_fat',   label: 'Lose Fat',          emoji: '🔥', desc: 'Burn fat & get lean' },
  { id: 'build_muscle', label: 'Build Muscle',    emoji: '💪', desc: 'Gain size & strength' },
  { id: 'get_stronger', label: 'Get Stronger',    emoji: '⚡', desc: 'Increase max lifts' },
  { id: 'endurance',  label: 'Improve Endurance', emoji: '🏃', desc: 'Cardio & stamina' },
  { id: 'maintain',   label: 'Maintain',          emoji: '⚖️', desc: 'Stay consistent' },
]

const INTENSITY_LEVELS = [
  { value: 1, label: 'Easy',         desc: 'Light effort, basic movements' },
  { value: 2, label: 'Moderate',     desc: 'Comfortable push, some sweat' },
  { value: 3, label: 'Intermediate', desc: 'Challenging but doable' },
  { value: 4, label: 'Hard',         desc: 'Heavy lifts, high effort' },
  { value: 5, label: 'Elite',        desc: 'Max intensity, no excuses' },
]

const TIMES = ['Morning', 'Afternoon', 'Evening', 'Flexible']

const slide = {
  enter: { x: 60, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -60, opacity: 0 },
}

export default function Onboarding({ onComplete }) {
  const [mode, setMode] = useState(hasAnyUsers() ? 'login' : 'signup') // 'signup' | 'login'
  const [step, setStep] = useState(0) // 0-7 for signup steps
  const [direction, setDirection] = useState(1)

  // Account fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [authError, setAuthError] = useState('')

  // Profile fields
  const [goal, setGoal] = useState('')
  const [daysPerWeek, setDaysPerWeek] = useState(4)
  const [sessionDuration, setSessionDuration] = useState(60)
  const [preferredTime, setPreferredTime] = useState('Flexible')
  const [intensity, setIntensity] = useState(3)
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [sex, setSex] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [currentPhoto, setCurrentPhoto] = useState(null)
  const [dreamPhoto, setDreamPhoto] = useState(null)

  // Plan generation
  const [generating, setGenerating] = useState(false)
  const [plan, setPlan] = useState(null)
  const [validating, setValidating] = useState(false)

  const currentRef = useRef()
  const dreamRef = useRef()

  const TOTAL_STEPS = 8

  const goNext = () => {
    setDirection(1)
    setStep(s => s + 1)
  }
  const goBack = () => {
    setDirection(-1)
    setStep(s => s - 1)
  }

  const handlePhotoUpload = (e, setter) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setter(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleGeneratePlan = async () => {
    setGenerating(true)
    setDirection(1)
    setStep(8)
    const selectedGoal = GOALS.find(g => g.id === goal)
    const intensityLabel = INTENSITY_LEVELS.find(i => i.value === intensity)?.label
    const planText = await generateWorkoutPlan({
      name, goal: selectedGoal?.label, daysPerWeek, sessionDuration,
      preferredTime, intensity: intensityLabel, age, weight, height, sex,
      additionalNotes,
      hasCurrentPhoto: !!currentPhoto, hasDreamPhoto: !!dreamPhoto,
      currentPhotoBase64: currentPhoto ? currentPhoto.split(',')[1] : null,
      dreamPhotoBase64: dreamPhoto ? dreamPhoto.split(',')[1] : null,
    })
    setPlan(planText)
    setGenerating(false)
  }

  const handleFinish = () => {
    const profile = {
      goal, daysPerWeek, sessionDuration, preferredTime,
      intensity, age, weight, height, sex,
      additionalNotes,
      currentPhoto, dreamPhoto, workoutPlan: plan,
      onboardedAt: new Date().toISOString(),
    }
    const result = signup({ name, email, password, profile })
    if (result.error) { setAuthError(result.error); return }
    inviteCodes.markUsed(inviteCode, email).catch(console.error)
    onComplete(result.user)
  }

  const handleLogin = () => {
    setAuthError('')
    const result = login({ email: loginEmail, password: loginPassword })
    if (result.error) { setAuthError(result.error); return }
    onComplete(result.user)
  }

  // ── LOGIN SCREEN ──
  if (mode === 'login') {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">💪</div>
            <h1 className="text-3xl font-black text-white tracking-tight">GrindMetric</h1>
            <p className="text-gray-500 text-sm mt-1">Welcome back. Let's grind.</p>
          </div>
          <div className="space-y-3 mb-4">
            <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
              type="email" placeholder="Email" className="input-field w-full h-12 text-sm" />
            <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
              type="password" placeholder="Password" className="input-field w-full h-12 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          {authError && <p className="text-red-400 text-xs text-center mb-3">{authError}</p>}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogin}
            disabled={!loginEmail || !loginPassword}
            className="btn-primary w-full py-4 text-base mb-4 disabled:opacity-30">
            Sign In
          </motion.button>
          <button onClick={() => { setMode('signup'); setStep(0); setAuthError('') }}
            className="w-full text-center text-sm text-gray-500 hover:text-brand-400 transition-colors">
            No account? <span className="text-brand-400 font-bold">Create one free</span>
          </button>
        </motion.div>
      </div>
    )
  }

  // ── SIGNUP FLOW ──
  const progressPct = step === 8 ? 100 : Math.round((step / TOTAL_STEPS) * 100)

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col">
      {/* Progress bar */}
      {step > 0 && step < 8 && (
        <div className="h-0.5 w-full bg-white/5">
          <motion.div className="h-full bg-brand-500" animate={{ width: `${progressPct}%` }} transition={{ duration: 0.4 }} />
        </div>
      )}

      <div className="flex-1 flex flex-col px-6 pt-8 pb-8 overflow-y-auto">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={step} custom={direction} variants={slide}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex-1 flex flex-col"
          >

            {/* STEP 0: Account Creation */}
            {step === 0 && (
              <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                <div className="text-center mb-8">
                  <div className="text-5xl mb-3">💪</div>
                  <h1 className="text-3xl font-black text-white tracking-tight">GrindMetric</h1>
                  <p className="text-gray-500 text-sm mt-2">Invite only — enter your code to join</p>
                </div>
                <div className="space-y-3 mb-6">
                  <div className="relative">
                    <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="Invite code (e.g. WXYZ-AB12)"
                      className="input-field w-full h-12 text-sm font-mono tracking-widest uppercase"
                      style={{ letterSpacing: '0.12em' }} />
                  </div>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="Your name" className="input-field w-full h-12 text-sm" />
                  <input value={email} onChange={e => setEmail(e.target.value)}
                    type="email" placeholder="Email" className="input-field w-full h-12 text-sm" />
                  <input value={password} onChange={e => setPassword(e.target.value)}
                    type="password" placeholder="Password (min 6 chars)" className="input-field w-full h-12 text-sm" />
                </div>
                {authError && <p className="text-red-400 text-xs text-center mb-3">{authError}</p>}
                <motion.button whileTap={{ scale: 0.97 }} onClick={async () => {
                  setAuthError('')
                  if (!inviteCode.trim()) { setAuthError('Enter your invite code to continue.'); return }
                  if (!name.trim() || !email.trim() || password.length < 6) return
                  setValidating(true)
                  const valid = await inviteCodes.validate(inviteCode)
                  setValidating(false)
                  if (!valid) { setAuthError('Invalid or already-used invite code.'); return }
                  goNext()
                }}
                  disabled={validating || !inviteCode.trim() || !name.trim() || !email.trim() || password.length < 6}
                  className="btn-primary w-full py-4 text-base mb-4 disabled:opacity-30">
                  {validating ? 'Checking...' : 'Continue →'}
                </motion.button>
                <button onClick={() => { setMode('login'); setAuthError('') }}
                  className="w-full text-center text-sm text-gray-500 hover:text-brand-400 transition-colors">
                  Already have an account? <span className="text-brand-400 font-bold">Sign in</span>
                </button>
              </div>
            )}

            {/* STEP 1: Goal */}
            {step === 1 && (
              <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
                <StepHeader step={1} total={TOTAL_STEPS} onBack={goBack}
                  title="What's your main goal?" subtitle="This shapes your entire program" />
                <div className="space-y-2.5 flex-1">
                  {GOALS.map(g => (
                    <motion.button key={g.id} whileTap={{ scale: 0.98 }}
                      onClick={() => setGoal(g.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                      style={{
                        background: goal === g.id ? 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(74,222,128,0.08))' : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${goal === g.id ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: goal === g.id ? '0 0 20px rgba(34,197,94,0.15)' : 'none',
                      }}>
                      <span className="text-3xl">{g.emoji}</span>
                      <div>
                        <p className="font-bold text-white text-base leading-none">{g.label}</p>
                        <p className="text-xs text-gray-500 mt-1">{g.desc}</p>
                      </div>
                      {goal === g.id && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="ml-auto w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-black text-xs font-black">✓</motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={goNext} disabled={!goal}
                  className="btn-primary w-full py-4 text-base mt-4 disabled:opacity-30">
                  Continue →
                </motion.button>
              </div>
            )}

            {/* STEP 2: Availability */}
            {step === 2 && (
              <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
                <StepHeader step={2} total={TOTAL_STEPS} onBack={goBack}
                  title="When can you train?" subtitle="Be honest — we'll build around your real schedule" />
                <div className="space-y-6 flex-1">
                  <div>
                    <div className="flex justify-between items-baseline mb-2">
                      <p className="text-sm font-bold text-white">Days per week</p>
                      <p className="text-2xl font-black text-brand-400">{daysPerWeek}<span className="text-sm text-gray-500 font-normal"> days</span></p>
                    </div>
                    <SliderInput value={daysPerWeek} onChange={setDaysPerWeek} min={1} max={7} />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-1.5 px-0.5">
                      {[1,2,3,4,5,6,7].map(d => <span key={d}>{d}</span>)}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline mb-2">
                      <p className="text-sm font-bold text-white">Session duration</p>
                      <p className="text-2xl font-black text-brand-400">{sessionDuration}<span className="text-sm text-gray-500 font-normal"> min</span></p>
                    </div>
                    <SliderInput value={sessionDuration} onChange={setSessionDuration} min={20} max={120} step={5} />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-1.5 px-0.5">
                      <span>20m</span><span>45m</span><span>60m</span><span>90m</span><span>2h</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-white mb-3">Preferred workout time</p>
                    <div className="grid grid-cols-2 gap-2">
                      {TIMES.map(t => (
                        <motion.button key={t} whileTap={{ scale: 0.95 }} onClick={() => setPreferredTime(t)}
                          className="py-3 rounded-xl text-sm font-semibold transition-all"
                          style={{
                            background: preferredTime === t ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${preferredTime === t ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.07)'}`,
                            color: preferredTime === t ? '#4ade80' : '#9ca3af',
                          }}>
                          {t}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={goNext} className="btn-primary w-full py-4 text-base mt-6">
                  Continue →
                </motion.button>
              </div>
            )}

            {/* STEP 3: Intensity */}
            {step === 3 && (
              <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
                <StepHeader step={3} total={TOTAL_STEPS} onBack={goBack}
                  title="How hard will you push?" subtitle="Your intensity level shapes exercise selection and volume" />
                <div className="flex-1 flex flex-col justify-center space-y-6">
                  <div className="text-center">
                    <motion.div key={intensity} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="text-6xl mb-3">
                      {['😌', '🙂', '😤', '🔥', '💀'][intensity - 1]}
                    </motion.div>
                    <p className="text-2xl font-black text-brand-400">{INTENSITY_LEVELS[intensity - 1].label}</p>
                    <p className="text-sm text-gray-500 mt-1">{INTENSITY_LEVELS[intensity - 1].desc}</p>
                  </div>

                  <div className="px-2">
                    <SliderInput value={intensity} onChange={setIntensity} min={1} max={5} color="#22c55e" />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-2 px-0.5">
                      <span>Easy</span><span>Moderate</span><span>Mid</span><span>Hard</span><span>Elite</span>
                    </div>
                  </div>

                  {/* Intensity preview cards */}
                  <div className="grid grid-cols-5 gap-1">
                    {INTENSITY_LEVELS.map(lvl => (
                      <motion.button key={lvl.value} whileTap={{ scale: 0.9 }}
                        onClick={() => setIntensity(lvl.value)}
                        className="py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: intensity === lvl.value ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${intensity === lvl.value ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)'}`,
                          color: intensity === lvl.value ? '#4ade80' : '#4b5563',
                        }}>
                        {lvl.value}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={goNext} className="btn-primary w-full py-4 text-base">
                  Continue →
                </motion.button>
              </div>
            )}

            {/* STEP 4: Body Stats */}
            {step === 4 && (
              <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
                <StepHeader step={4} total={TOTAL_STEPS} onBack={goBack}
                  title="Your stats" subtitle="Used to estimate your timeline and calorie targets" />
                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Age', value: age, set: setAge, placeholder: 'e.g. 24', suffix: 'yrs', type: 'number' },
                      { label: 'Weight', value: weight, set: setWeight, placeholder: 'e.g. 80', suffix: 'kg', type: 'number' },
                      { label: 'Height', value: height, set: setHeight, placeholder: 'e.g. 178', suffix: 'cm', type: 'number' },
                    ].map(({ label, value: v, set, placeholder, suffix, type }) => (
                      <div key={label} className="card p-3">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{label}</p>
                        <div className="flex items-baseline gap-1">
                          <input type={type} inputMode="numeric" value={v} onChange={e => set(e.target.value)}
                            placeholder={placeholder}
                            className="flex-1 bg-transparent text-white text-lg font-black outline-none w-full" />
                          <span className="text-xs text-gray-600">{suffix}</span>
                        </div>
                      </div>
                    ))}
                    <div className="card p-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Sex</p>
                      <div className="flex gap-2">
                        {['M', 'F'].map(s => (
                          <button key={s} onClick={() => setSex(s)}
                            className="flex-1 py-1.5 rounded-lg text-sm font-bold transition-all"
                            style={{
                              background: sex === s ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                              border: `1px solid ${sex === s ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
                              color: sex === s ? '#4ade80' : '#6b7280',
                            }}>
                            {s === 'M' ? 'Male' : 'Female'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-600 text-center">All fields optional — better data = better plan</p>
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={goNext} className="btn-primary w-full py-4 text-base">
                  Continue →
                </motion.button>
              </div>
            )}

            {/* STEP 5: Additional Notes */}
            {step === 5 && (
              <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
                <StepHeader step={5} total={TOTAL_STEPS} onBack={goBack}
                  title="Anything else?" subtitle="Tell us about limitations, your setup, or anything we should know" />
                <div className="flex-1 flex flex-col gap-4">
                  <textarea
                    value={additionalNotes}
                    onChange={e => setAdditionalNotes(e.target.value)}
                    placeholder={"Examples:\n• I can also work out at home 3 days a week without equipment\n• I have a shoulder injury\n• I only have 45 minutes on weekdays"}
                    rows={6}
                    className="input-field w-full p-4 resize-none leading-relaxed"
                    style={{ minHeight: '160px' }}
                  />
                  <p className="text-[11px] text-gray-600 text-center">
                    Gemini AI will incorporate this context into your plan — the more detail, the better.
                  </p>
                </div>
                <div className="space-y-2 mt-4">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={goNext}
                    disabled={!additionalNotes.trim()}
                    className="btn-primary w-full py-4 text-base disabled:opacity-30">
                    Continue →
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={goNext}
                    className="w-full py-3.5 rounded-xl text-sm font-bold transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Skip for now
                  </motion.button>
                </div>
              </div>
            )}

            {/* STEP 6: Current Physique */}
            {step === 6 && (
              <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
                <StepHeader step={6} total={TOTAL_STEPS} onBack={goBack}
                  title="Current physique" subtitle="Optional — AI will analyze and tailor your plan" />
                <div className="flex-1 flex flex-col">
                  <input ref={currentRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => handlePhotoUpload(e, setCurrentPhoto)} />
                  {currentPhoto ? (
                    <div className="relative flex-1 max-h-72 rounded-2xl overflow-hidden mb-4">
                      <img src={currentPhoto} alt="current" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        <span className="text-xs text-white font-bold bg-black/40 px-3 py-1 rounded-full">Current physique ✓</span>
                        <button onClick={() => setCurrentPhoto(null)}
                          className="text-white bg-black/50 rounded-full w-7 h-7 flex items-center justify-center text-lg">×</button>
                      </div>
                    </div>
                  ) : (
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => currentRef.current.click()}
                      className="flex-1 max-h-72 flex flex-col items-center justify-center gap-3 rounded-2xl mb-4"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.1)' }}>
                      <span className="text-5xl">📸</span>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">Upload current physique</p>
                        <p className="text-xs text-gray-600 mt-1">AI coach will analyze your starting point</p>
                      </div>
                    </motion.button>
                  )}
                  <div className="space-y-2">
                    {!currentPhoto && (
                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => currentRef.current.click()}
                        className="btn-primary w-full py-3.5 text-sm">
                        📷 Take or Upload Photo
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.97 }} onClick={goNext}
                      className="w-full py-3.5 rounded-xl text-sm font-bold transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {currentPhoto ? 'Continue →' : 'Skip for now'}
                    </motion.button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7: Dream Physique */}
            {step === 7 && (
              <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
                <StepHeader step={7} total={TOTAL_STEPS} onBack={goBack}
                  title="Dream physique" subtitle="Show us where you want to be — AI estimates your timeline" />
                <div className="flex-1 flex flex-col">
                  <input ref={dreamRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => handlePhotoUpload(e, setDreamPhoto)} />
                  {dreamPhoto ? (
                    <div className="relative flex-1 max-h-72 rounded-2xl overflow-hidden mb-4">
                      <img src={dreamPhoto} alt="dream" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        <span className="text-xs text-white font-bold bg-black/40 px-3 py-1 rounded-full">Dream physique ✓</span>
                        <button onClick={() => setDreamPhoto(null)}
                          className="text-white bg-black/50 rounded-full w-7 h-7 flex items-center justify-center text-lg">×</button>
                      </div>
                    </div>
                  ) : (
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => dreamRef.current.click()}
                      className="flex-1 max-h-72 flex flex-col items-center justify-center gap-3 rounded-2xl mb-4"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.1)' }}>
                      <span className="text-5xl">🏆</span>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">Upload your goal physique</p>
                        <p className="text-xs text-gray-600 mt-1">We'll estimate how long it'll take to get there</p>
                      </div>
                    </motion.button>
                  )}
                  <div className="space-y-2">
                    {!dreamPhoto && (
                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => dreamRef.current.click()}
                        className="btn-primary w-full py-3.5 text-sm">
                        🏆 Upload Dream Photo
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.97 }} onClick={handleGeneratePlan}
                      className="w-full py-3.5 rounded-xl text-sm font-bold"
                      style={{ background: dreamPhoto ? 'linear-gradient(135deg, #22c55e, #4ade80)' : 'rgba(34,197,94,0.12)', color: dreamPhoto ? '#000' : '#4ade80', border: dreamPhoto ? 'none' : '1px solid rgba(34,197,94,0.3)' }}>
                      ✨ Generate My Plan
                    </motion.button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 8: Generated Plan */}
            {step === 8 && (
              <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
                {generating ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                    <div className="relative w-24 h-24">
                      {[0, 1, 2].map(i => (
                        <motion.div key={i}
                          className="absolute inset-0 rounded-full border-2 border-brand-500/40"
                          animate={{ scale: [1, 1.5 + i * 0.3], opacity: [0.6, 0] }}
                          transition={{ repeat: Infinity, duration: 2, delay: i * 0.5, ease: 'easeOut' }}
                        />
                      ))}
                      <div className="absolute inset-0 flex items-center justify-center text-4xl">🤖</div>
                    </div>
                    <div>
                      <p className="text-xl font-black text-white">Building your plan...</p>
                      <p className="text-sm text-gray-500 mt-2">AI is analyzing your goals{(currentPhoto || dreamPhoto) ? ' and photos' : ''}</p>
                    </div>
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map(i => (
                        <motion.div key={i} className="w-2 h-2 bg-brand-500 rounded-full"
                          animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                      ))}
                    </div>
                  </div>
                ) : plan ? (
                  <div className="flex-1 flex flex-col">
                    <div className="text-center mb-5">
                      <div className="text-4xl mb-2">🎯</div>
                      <h2 className="text-2xl font-black text-white">Your Plan is Ready</h2>
                      <p className="text-sm text-gray-500 mt-1">Personalized for {name}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto rounded-2xl p-4 mb-4"
                      style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{plan}</p>
                    </div>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={handleFinish}
                      className="btn-primary w-full py-4 text-base">
                      Start Grinding 💪
                    </motion.button>
                  </div>
                ) : null}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function StepHeader({ step, total, onBack, title, subtitle }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
          ←
        </button>
        <span className="text-xs font-bold text-gray-600">{step} of {total}</span>
      </div>
      <h2 className="text-2xl font-black text-white leading-tight">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1.5">{subtitle}</p>}
    </div>
  )
}

function SliderInput({ value, onChange, min, max, step = 1, color = '#22c55e' }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="relative h-8 flex items-center">
      <div className="absolute w-full h-1.5 rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-all duration-100"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}aa, ${color})` }} />
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="absolute w-full opacity-0 cursor-pointer h-8"
        style={{ WebkitAppearance: 'none' }}
      />
      <div className="absolute w-5 h-5 rounded-full border-2 pointer-events-none transition-all duration-100"
        style={{ left: `calc(${pct}% - 10px)`, background: '#030712', borderColor: color, boxShadow: `0 0 8px ${color}66` }} />
    </div>
  )
}
