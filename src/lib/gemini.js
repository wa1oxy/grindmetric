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
  if (profile.goal) lines.push(`Goal: ${profile.goal.replace(/_/g, ' ')}`)
  if (profile.daysPerWeek) lines.push(`Trains ${profile.daysPerWeek} days/week`)
  if (profile.sessionDuration) lines.push(`Sessions: ${profile.sessionDuration} min`)
  if (profile.intensity) lines.push(`Intensity: ${profile.intensity}/5`)
  if (profile.age) lines.push(`Age: ${profile.age}`)
  if (profile.weight) lines.push(`Weight: ${profile.weight}kg`)
  if (profile.height) lines.push(`Height: ${profile.height}cm`)
  if (profile.sex) lines.push(`Sex: ${profile.sex}`)
  return lines.length ? `\nUser profile:\n${lines.join('\n')}` : ''
}

export async function getCoachingFeedback({ workouts, nutrition, weightTrend, streak, userProfile }) {
  const key = cacheKey(`coaching_${new Date().toDateString()}`)
  const cached = getCached(key)
  if (cached) return cached

  const workoutSummary = workouts.length
    ? workouts.map(w => `${w.exercise} ${w.weight}lbs x${w.reps}x${w.sets}`).join(', ')
    : 'No workouts today'

  const prompt = `You are an elite, brutally honest personal fitness coach. ${profileContext(userProfile)}

Today this user logged:
Workouts: ${workoutSummary}
Nutrition: ${nutrition.calories || 0} cal, ${nutrition.protein || 0}g protein, ${nutrition.carbs || 0}g carbs, ${nutrition.fat || 0}g fat
Weight trend (last 7 days): ${weightTrend || 'No data'}
Streak: ${streak} days consecutive

Give exactly 2-3 sentences of personalized, honest feedback tailored to their goal and stats. No fluff. Specific advice on what to fix or keep.`

  const result = await callGemini(prompt)
  if (result) setCache(key, result)
  return result
}

export async function generateWorkoutPlan({ name, goal, daysPerWeek, sessionDuration, preferredTime, intensity, age, weight, height, sex, hasCurrentPhoto, hasDreamPhoto, currentPhotoBase64, dreamPhotoBase64 }) {
  const stats = [age && `Age: ${age}`, weight && `Weight: ${weight}kg`, height && `Height: ${height}cm`, sex && `Sex: ${sex}`].filter(Boolean).join(', ')

  const prompt = `You are an elite personal trainer creating a personalized fitness plan. Here are the client's details:
Name: ${name}
Goal: ${goal}
Training days per week: ${daysPerWeek}
Session duration: ${sessionDuration} minutes
Preferred time: ${preferredTime}
Intensity level: ${intensity}/5
${stats ? `Stats: ${stats}` : ''}
${hasCurrentPhoto ? 'Current physique photo provided (assess their starting point)' : ''}
${hasDreamPhoto ? 'Dream physique photo provided (this is their target look)' : ''}

Create a complete, realistic training plan. Include:
1. **Weekly Schedule** — which muscle groups on which days (specific, no fluff)
2. **Key Exercises** — 3-4 core movements per session
3. **Volume & Intensity** — sets/reps/progression scheme matching their intensity level
4. **Estimated Timeline** — honest estimate to reach their goal given their availability and intensity (weeks/months ranges)
5. **Top 3 Tips** — specific advice for this person's goal

Be direct, specific, and brutally honest. No motivational fluff. Format clearly with sections.`

  const parts = [{ text: prompt }]
  if (currentPhotoBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: currentPhotoBase64 } })
  if (dreamPhotoBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: dreamPhotoBase64 } })

  const result = await callGemini(prompt, null, parts)
  return result || 'Could not generate plan. Check your internet connection and try again.'
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

export async function analyzeProgressPhoto(base64Image) {
  const prompt = `You are an elite fitness coach reviewing a progress photo. Give 2-3 sentences of honest, specific feedback on body composition, visible muscle development, and one area to focus on. No flattery.`
  return callGemini(prompt, base64Image)
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

async function callGemini(prompt, base64Image = null, customParts = null) {
  if (!GEMINI_API_KEY) return null

  let parts = customParts || [{ text: prompt }]
  if (!customParts && base64Image) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Image } })
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      }
    )
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch {
    return null
  }
}
