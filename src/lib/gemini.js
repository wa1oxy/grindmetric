const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

let _userId = ''
export function setGeminiUserId(id) { _userId = id || '' }

function cacheKey(name) { return `${_userId ? `${_userId}_` : ''}gm_ai_${name}` }

function getCache(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}
function setCache(key, value) {
  localStorage.setItem(key, JSON.stringify({ value, ts: Date.now() }))
}
function getCached(key) {
  const entry = getCache(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.value
  return null
}

function profileContext(profile) {
  if (!profile) return ''
  const lines = []
  if (profile.goal) lines.push(`Primary goal: ${profile.goal.replace(/_/g, ' ')}`)
  if (profile.sex) lines.push(`Sex: ${profile.sex}`)
  if (profile.age) lines.push(`Age: ${profile.age}`)
  if (profile.weight) lines.push(`Weight: ${profile.weight}kg`)
  if (profile.height) lines.push(`Height: ${profile.height}cm`)
  if (profile.daysPerWeek) lines.push(`Training days per week: ${profile.daysPerWeek}`)
  if (profile.sessionDuration) lines.push(`Session length: ${profile.sessionDuration} min`)
  if (profile.preferredTime) lines.push(`Preferred time: ${profile.preferredTime}`)
  if (profile.intensity) lines.push(`Self-rated intensity: ${profile.intensity}/5`)
  if (profile.nutritionGoals) {
    const g = profile.nutritionGoals
    lines.push(`Daily targets: ${g.calories} cal, ${g.protein}g protein, ${g.carbs}g carbs, ${g.fat}g fat`)
  }
  if (profile.workoutPlan) lines.push(`Has an AI-generated workout plan: yes`)
  if (profile.gymSchedule) {
    const days = Object.entries(profile.gymSchedule).map(([d, t]) => `${d}:${t}`).join(', ')
    lines.push(`Gym schedule: ${days}`)
  }
  if (profile.additionalNotes) lines.push(`User's own notes from signup: "${profile.additionalNotes}"`)
  return lines.length ? `USER PROFILE:\n${lines.join('\n')}` : ''
}

export async function getCoachingFeedback({ workouts, nutrition, weightTrend, streak, userProfile, workoutHistory, weightLogs, foods, goals }) {
  const workoutSummary = workouts.length
    ? workouts.map(w => `${w.exercise} ${w.weight}lbs x${w.reps}x${w.sets}`).join(', ')
    : 'No workouts today'

  // Last 7 days of workout history
  const historyLines = (workoutHistory || []).slice(0, 30).map(w => `${w.exercise} ${w.weight}lbs x${w.reps}x${w.sets}`).join(', ') || 'No recent history'

  // PRs: max weight per exercise across all history
  const prMap = {}
  ;(workoutHistory || []).forEach(w => {
    if (!prMap[w.exercise] || w.weight > prMap[w.exercise]) prMap[w.exercise] = w.weight
  })
  const prLines = Object.entries(prMap).slice(0, 8).map(([ex, wt]) => `${ex}: ${wt}lbs`).join(', ') || 'No PRs yet'

  // Weekly nutrition averages (last 7 days of food logs)
  const weekFoods = (foods || []).filter(f => new Date(f.created_at) > new Date(Date.now() - 7 * 86400000))
  const dayMap = {}
  weekFoods.forEach(f => {
    const d = f.created_at.split('T')[0]
    if (!dayMap[d]) dayMap[d] = { cal: 0, protein: 0 }
    dayMap[d].cal += f.calories || 0
    dayMap[d].protein += f.protein_g || 0
  })
  const dayCount = Object.keys(dayMap).length
  const avgCal = dayCount ? Math.round(Object.values(dayMap).reduce((s, d) => s + d.cal, 0) / dayCount) : 0
  const avgProtein = dayCount ? Math.round(Object.values(dayMap).reduce((s, d) => s + d.protein, 0) / dayCount) : 0

  // Weight logs summary
  const weightSummary = (weightLogs || []).slice(0, 7).map(w => `${w.log_date || w.created_at?.split('T')[0]}: ${w.weight_kg}kg`).join(', ') || weightTrend || 'No data'

  // Goal adherence
  const calGoal = goals?.calories || userProfile?.nutritionGoals?.calories
  const proteinGoal = goals?.protein || userProfile?.nutritionGoals?.protein
  const calAdherence = calGoal ? `${nutrition.calories || 0}/${calGoal} cal (${Math.round(((nutrition.calories || 0) / calGoal) * 100)}%)` : `${nutrition.calories || 0} cal`
  const proteinAdherence = proteinGoal ? `${nutrition.protein || 0}/${proteinGoal}g protein (${Math.round(((nutrition.protein || 0) / proteinGoal) * 100)}%)` : `${nutrition.protein || 0}g protein`

  const prompt = `You are an elite, brutally honest personal fitness coach with full access to this user's data. ${profileContext(userProfile)}

TODAY (${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}):
Workouts: ${workoutSummary}
Calories: ${calAdherence}
Protein: ${proteinAdherence}
Carbs: ${nutrition.carbs || 0}g | Fat: ${nutrition.fat || 0}g

RECENT HISTORY (last 7 days):
Workouts: ${historyLines}
Personal Records: ${prLines}
Weekly avg: ${avgCal} cal/day, ${avgProtein}g protein/day (over ${dayCount} tracked days)
Weight log: ${weightSummary}
Streak: ${streak} days consecutive

Re-evaluate everything from scratch. Give 3-4 sentences of brutally honest, hyper-personalized feedback based on ALL this data. Be specific — reference their actual exercises, weights, PRs, nutrition numbers, and how they align with their stated goal. Call out what's working and what must change right now. No generic advice.`

  const result = await callGemini(prompt)
  return result
}

export async function generateWorkoutPlan({ name, goal, daysPerWeek, sessionDuration, preferredTime, intensity, age, weight, height, sex, additionalNotes, hasCurrentPhoto, hasDreamPhoto, currentPhotoBase64, dreamPhotoBase64 }) {
  const stats = [age && `Age: ${age}`, weight && `Weight: ${weight}kg`, height && `Height: ${height}cm`, sex && `Sex: ${sex}`].filter(Boolean).join(', ')

  const prompt = `You are an elite personal trainer building a highly specific plan. Think carefully before writing anything.

CLIENT:
Name: ${name} | Goal: ${goal} | ${daysPerWeek} days/week | ${sessionDuration} min sessions | Intensity: ${intensity}/5
${stats ? `Stats: ${stats}` : ''}
${additionalNotes ? `IMPORTANT — Client notes (read carefully and build the entire plan around this): "${additionalNotes}"` : ''}
${hasCurrentPhoto ? 'Current physique photo provided.' : ''}${hasDreamPhoto ? ' Dream physique photo provided.' : ''}

RULES BEFORE YOU WRITE:
- Extract every piece of equipment and constraint from the client notes. Use ALL of it.
${intensity === 'Elite' || intensity === '5' || intensity === 5 ? '- NEVER assign rest days. Every day gets a workout — use gym or home equipment accordingly.' : '- Assign rest days appropriately for their intensity level, but home days with equipment should still get light/active sessions.'}
- If they have a decline bench at home: program decline push-up variations, pike push-ups, dips off bench, ab work, etc.
- If they have bodyweight only: program push-up variations, pull variations, lunges, core, holds — not rest.
- Gym days = barbell/machine work. Home days = creative bodyweight + whatever they have.
- Every single training day must have real exercises. No wasted days.

No intro. No fluff. Use **bold** for exercise names and key numbers. Use this exact format:

## THE GAP
${hasCurrentPhoto && hasDreamPhoto ? 'From the photos: ' : ''}2 sentences. What's physically missing and what this plan targets.

## WEEKLY SPLIT
Each day on its OWN LINE. No pipes. Format exactly like this:
**Mon (Gym):** Heavy Push
**Tue (Home):** Decline Push-ups + Core
**Wed:** Rest

## KEY LIFTS
6-8 exercises covering both gym and home days. Format: "**Exercise Name** | sets x reps | why it matters for this goal"

## NUTRITION
2 sentences. Bold the **calorie target** and **protein target**. Specific to their goal.

## TIMELINE
2 sentences. Bold the key milestones. Be honest about what takes time.`

  const parts = [{ text: prompt }]
  if (currentPhotoBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: currentPhotoBase64 } })
  if (dreamPhotoBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: dreamPhotoBase64 } })

  const result = await callGemini(prompt, null, parts)
  if (result === '__NO_API_KEY__') return '⚠️ Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your Vercel environment variables and redeploy.'
  if (result) return result

  // Retry without photos if multimodal call failed
  if (currentPhotoBase64 || dreamPhotoBase64) {
    console.warn('[Gemini] Multimodal call failed, retrying without photos...')
    const fallback = await callGemini(prompt)
    if (fallback && fallback !== '__NO_API_KEY__') return fallback
  }

  return 'Could not generate plan. Check your internet connection and try again.'
}

export async function getWeeklySummary({ workouts, nutrition, weightLogs, streak, userProfile }) {
  const key = cacheKey(`weekly_${new Date().toISOString().slice(0, 10)}_${new Date().getDay()}`)
  const cached = getCached(key)
  if (cached) return cached

  const goalLabel = userProfile?.goal?.replace(/_/g, ' ') || 'general fitness'
  const workoutCount = workouts.length
  const exercises = [...new Set(workouts.map(w => w.exercise))].slice(0, 5).join(', ')
  const avgCal = nutrition.length > 0
    ? Math.round(nutrition.reduce((s, d) => s + d, 0) / nutrition.length)
    : 0
  const weightChange = weightLogs.length >= 2
    ? (weightLogs[0].weight_kg - weightLogs[weightLogs.length - 1].weight_kg).toFixed(1)
    : null

  const prompt = `You are an elite fitness coach giving a weekly performance review. ${profileContext(userProfile)}

This week:
Goal: ${goalLabel}
Workouts completed: ${workoutCount} sessions
Exercises: ${exercises || 'none logged'}
Average daily calories: ${avgCal} kcal
Streak: ${streak} days
${weightChange !== null ? `Weight change: ${weightChange > 0 ? '+' : ''}${weightChange}kg` : ''}

Give a 3-sentence weekly summary personalized to their goal: what went well, what to fix next week, and one specific action item. Be direct and data-driven.`

  const result = await callGemini(prompt)
  if (result) setCache(key, result)
  return result
}

export async function analyzeWorkoutPlan({ workoutHistory, workoutPlan, dreamPhotoBase64, userProfile }) {
  const recentLifts = workoutHistory.slice(0, 20).map(w => `${w.exercise} ${w.weight}lbs x${w.reps}x${w.sets}`).join('\n') || 'No workouts logged yet'

  const prompt = `You are an elite coach reviewing whether this person's workout routine will actually transform their body into their goal physique.

${profileContext(userProfile)}

THEIR RECOMMENDED PLAN:
${workoutPlan || 'No plan on file'}

WHAT THEY'VE ACTUALLY BEEN LOGGING:
${recentLifts}
${dreamPhotoBase64 ? '\nDream physique photo attached — assess against this target.' : ''}

No intro. Use **bold** for key points. Use this exact format:

## VERDICT
2 sentences. Is what they're doing aligned with their goal? Be honest.

## GAPS
2-3 bullet points. What's missing or wrong in their actual training vs what's needed.

## ON TRACK FOR
One sentence. What physique will their current routine actually build — not what they want, what they'll get.

## ADJUSTMENTS
3 bullet points. Specific changes to make right now to get back on track toward their goal.`

  const parts = [{ text: prompt }]
  if (dreamPhotoBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: dreamPhotoBase64 } })
  return callGemini(prompt, null, parts)
}

export async function customizeWorkoutPlan({ currentPlan, request, userProfile }) {
  const prompt = `You are an elite personal trainer. A client has a workout plan and wants to make a change.

${profileContext(userProfile)}

CURRENT PLAN:
${currentPlan}

CLIENT REQUEST: "${request}"

Respond in this EXACT format — nothing else:

REPLY: [1-2 sentences: honest, direct answer to their request — tell them if it's a bad idea and why, or confirm the change. No fluff.]

PLAN:
[Full updated plan in the same ## section format as the original. Make the requested change if it's reasonable, or make the best version of it if it's not ideal.]`

  const result = await callGemini(prompt)
  if (!result || result === '__NO_API_KEY__') return null

  const replyMatch = result.match(/REPLY:\s*(.+?)(?=\nPLAN:|\n\nPLAN:)/s)
  const planMatch = result.match(/PLAN:\n([\s\S]+)/)

  return {
    reply: replyMatch?.[1]?.trim() || '',
    newPlan: planMatch?.[1]?.trim() || currentPlan,
  }
}

export async function analyzeProgressPhoto(base64Image) {
  const prompt = `You are an elite fitness coach reviewing a progress photo. Give 2-3 sentences of honest, specific feedback on body composition, visible muscle development, and one area to focus on. No flattery.`
  return callGemini(prompt, base64Image)
}

export async function compareProgressPhotos({ beforeBase64, afterBase64, beforeDate, afterDate, userProfile }) {
  const prompt = `You are an elite fitness coach comparing two progress photos to assess physical transformation.

Before photo date: ${beforeDate}
After photo date: ${afterDate}
${profileContext(userProfile)}

Look at both photos carefully and give:
1. **Visible Changes** — what's specifically different (body composition, muscle definition, posture, proportions)
2. **Honest Progress Rating** — are they actually moving toward their goal? Be direct.
3. **Top Priority** — the single most important thing to focus on next based on what you see

Be brutally honest. No empty praise. If progress is minimal or inconsistent, say so plainly. Keep it to 4-5 sentences total.`

  const parts = [
    { text: prompt },
    { inline_data: { mime_type: 'image/jpeg', data: beforeBase64 } },
    { inline_data: { mime_type: 'image/jpeg', data: afterBase64 } },
  ]
  return callGemini(prompt, null, parts)
}

export async function parseFoodFromText(text, userProfile) {
  const goal = userProfile?.goal?.replace(/_/g, ' ') || ''
  const prompt = `You are a nutrition expert. The user said: "${text}"

Parse this into individual food items with accurate nutritional data. ${goal ? `Their fitness goal is: ${goal}.` : ''}

Return ONLY a valid JSON array, no markdown, no explanation. Format:
[{"food_name":"...","calories":123,"protein_g":10,"carbs_g":20,"fat_g":5}]

Be accurate with common portions. If amounts are vague, use standard serving sizes. Include each distinct food as a separate item.`

  try {
    const result = await callGemini(prompt)
    if (!result) return null
    const match = result.match(/\[[\s\S]*\]/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

export async function chatWithCoach({ messages, userProfile }) {
  const history = messages.map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.text}`).join('\n')
  const prompt = `You are an elite personal fitness and nutrition coach. ${profileContext(userProfile)}

Conversation so far:
${history}

Respond as the Coach with practical, specific advice. Keep answers focused and concise (2-4 sentences max unless a detailed breakdown is needed). No generic filler — be direct and useful.`
  return callGemini(prompt)
}

function stripDataUrl(dataUrl) {
  if (!dataUrl) return dataUrl
  // Gemini needs raw base64 only — strip "data:image/...;base64," prefix
  const idx = dataUrl.indexOf(',')
  return idx !== -1 ? dataUrl.slice(idx + 1) : dataUrl
}

async function callGemini(prompt, base64Image = null, customParts = null) {
  if (!GEMINI_API_KEY) {
    console.error('[Gemini] VITE_GEMINI_API_KEY is not set')
    return '__NO_API_KEY__'
  }

  let parts = customParts || [{ text: prompt }]
  if (!customParts && base64Image) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: stripDataUrl(base64Image) } })
  }

  // Strip data URL prefixes from any inline_data parts
  parts = parts.map(p =>
    p.inline_data ? { ...p, inline_data: { ...p.inline_data, data: stripDataUrl(p.inline_data.data) } } : p
  )

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      }
    )
    const data = await res.json()
    if (data?.error) console.error('[Gemini] API error:', data.error.message)
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch (err) {
    console.error('[Gemini] fetch error:', err)
    return null
  }
}
