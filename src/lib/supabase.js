import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

let _client = null
export function getSupabaseClient() {
  if (!_client && isSupabaseConfigured()) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return _client
}

export const db = {
  async upsertUser(user) {
    const sb = getSupabaseClient()
    if (!sb) return false
    const { error } = await sb.from('gm_users').upsert({
      id: user.id,
      name: user.name,
      email: user.email,
      goal: user.profile?.goal,
      days_per_week: user.profile?.daysPerWeek ?? null,
      session_duration: user.profile?.sessionDuration ?? null,
      preferred_time: user.profile?.preferredTime ?? null,
      intensity: user.profile?.intensity ?? null,
      age: user.profile?.age ? parseInt(user.profile.age) : null,
      weight_kg: user.profile?.weight ? parseFloat(user.profile.weight) : null,
      height_cm: user.profile?.height ? parseFloat(user.profile.height) : null,
      sex: user.profile?.sex ?? null,
      additional_notes: user.profile?.additionalNotes ?? null,
      workout_plan: user.profile?.workoutPlan ?? null,
      onboarded_at: user.profile?.onboardedAt ?? null,
      profile_json: JSON.stringify(user.profile || {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (error) console.error('[Supabase] upsertUser:', error.message)
    return !error
  },

  async getUser(userId) {
    const sb = getSupabaseClient()
    if (!sb) return null
    const { data, error } = await sb.from('gm_users').select('*').eq('id', userId).single()
    if (error) return null
    return data
  },

  async getWorkouts(userId) {
    const sb = getSupabaseClient()
    if (!sb) return null
    const { data, error } = await sb.from('gm_workouts').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) { console.error('[Supabase] getWorkouts:', error.message); return null }
    return data
  },

  async addWorkout(entry) {
    const sb = getSupabaseClient()
    if (!sb) return false
    const { error } = await sb.from('gm_workouts').insert(entry)
    if (error) console.error('[Supabase] addWorkout:', error.message)
    return !error
  },

  async deleteWorkout(id) {
    const sb = getSupabaseClient()
    if (!sb) return false
    const { error } = await sb.from('gm_workouts').delete().eq('id', id)
    if (error) console.error('[Supabase] deleteWorkout:', error.message)
    return !error
  },

  async getFoods(userId) {
    const sb = getSupabaseClient()
    if (!sb) return null
    const { data, error } = await sb.from('gm_foods').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) { console.error('[Supabase] getFoods:', error.message); return null }
    return data
  },

  async addFood(entry) {
    const sb = getSupabaseClient()
    if (!sb) return false
    const { error } = await sb.from('gm_foods').insert(entry)
    if (error) console.error('[Supabase] addFood:', error.message)
    return !error
  },

  async deleteFood(id) {
    const sb = getSupabaseClient()
    if (!sb) return false
    const { error } = await sb.from('gm_foods').delete().eq('id', id)
    if (error) console.error('[Supabase] deleteFood:', error.message)
    return !error
  },

  async getInviteCodes() {
    const sb = getSupabaseClient()
    if (!sb) return null
    const { data, error } = await sb.from('gm_invite_codes').select('*').order('created_at', { ascending: false })
    if (error) { console.error('[Supabase] getInviteCodes:', error.message); return null }
    return data
  },

  async addInviteCode(entry) {
    const sb = getSupabaseClient()
    if (!sb) return false
    const { error } = await sb.from('gm_invite_codes').insert(entry)
    if (error) console.error('[Supabase] addInviteCode:', error.message)
    return !error
  },

  async deleteInviteCode(id) {
    const sb = getSupabaseClient()
    if (!sb) return false
    const { error } = await sb.from('gm_invite_codes').delete().eq('id', id)
    if (error) console.error('[Supabase] deleteInviteCode:', error.message)
    return !error
  },

  async markInviteCodeUsed(code, usedBy) {
    const sb = getSupabaseClient()
    if (!sb) return false
    const { error } = await sb.from('gm_invite_codes').update({ used: true, used_by: usedBy, used_at: new Date().toISOString() }).eq('code', code)
    if (error) console.error('[Supabase] markInviteCodeUsed:', error.message)
    return !error
  },

  async getWeightLogs(userId) {
    const sb = getSupabaseClient()
    if (!sb) return null
    const { data, error } = await sb.from('gm_weight_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) { console.error('[Supabase] getWeightLogs:', error.message); return null }
    return data
  },

  async addWeightLog(entry) {
    const sb = getSupabaseClient()
    if (!sb) return false
    const { error } = await sb.from('gm_weight_logs').insert(entry)
    if (error) console.error('[Supabase] addWeightLog:', error.message)
    return !error
  },
}
