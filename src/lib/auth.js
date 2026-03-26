import { getSupabaseClient, isSupabaseConfigured, db } from './supabase'

function buildUser(authUser, row) {
  let profile = {}
  if (row?.profile_json) {
    try { profile = JSON.parse(row.profile_json) } catch {}
  }
  if (!profile.goal && row) {
    profile = {
      goal: row.goal, daysPerWeek: row.days_per_week,
      sessionDuration: row.session_duration, preferredTime: row.preferred_time,
      intensity: row.intensity, age: row.age, weight: row.weight_kg,
      height: row.height_cm, sex: row.sex, additionalNotes: row.additional_notes,
      workoutPlan: row.workout_plan, onboardedAt: row.onboarded_at,
    }
  }
  return {
    id: authUser.id,
    email: authUser.email,
    name: row?.name || authUser.user_metadata?.name || '',
    profile,
  }
}

export async function signup({ name, email, password, profile }) {
  if (!isSupabaseConfigured()) return { error: 'Backend not configured.' }
  const sb = getSupabaseClient()
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { name }, emailRedirectTo: window.location.origin },
  })
  if (error) return { error: error.message }
  const userObj = { id: data.user.id, email, name, profile }
  await db.upsertUser(userObj)
  if (!data.session) return { needsVerification: true, email }
  return { user: userObj }
}

export async function login({ email, password }) {
  if (!isSupabaseConfigured()) return { error: 'Backend not configured.' }
  const sb = getSupabaseClient()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  const row = await db.getUser(data.user.id)
  return { user: buildUser(data.user, row) }
}

export async function logout() {
  if (!isSupabaseConfigured()) return
  await getSupabaseClient().auth.signOut()
}

export async function getSession() {
  if (!isSupabaseConfigured()) return null
  const sb = getSupabaseClient()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return null
  const row = await db.getUser(session.user.id)
  return buildUser(session.user, row)
}

export async function resetPassword(email) {
  if (!isSupabaseConfigured()) return { error: 'Backend not configured.' }
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  return error ? { error: error.message } : { success: true }
}

export function onAuthChange(callback) {
  if (!isSupabaseConfigured()) return () => {}
  const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange(callback)
  return () => subscription.unsubscribe()
}

export function hasAnyUsers() { return true }
