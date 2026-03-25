import { db, isSupabaseConfigured } from './supabase'

const USERS_KEY = 'gm_users'
const SESSION_KEY = 'gm_session'

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]') } catch { return [] }
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

export function signup({ name, email, password, profile }) {
  const users = getUsers()
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { error: 'An account with this email already exists' }
  }
  const user = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name,
    email: email.toLowerCase(),
    password,
    profile: profile || {},
    created_at: new Date().toISOString(),
  }
  users.push(user)
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  const session = { id: user.id, name: user.name, email: user.email, profile: user.profile }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  // Sync new user profile to Supabase
  if (isSupabaseConfigured()) {
    db.upsertUser(session).catch(console.error)
  }
  return { user: session }
}

export function login({ email, password }) {
  const users = getUsers()
  const user = users.find(u => u.email === email.toLowerCase() && u.password === password)
  if (!user) return { error: 'Invalid email or password' }
  const session = { id: user.id, name: user.name, email: user.email, profile: user.profile }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return { user: session }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function hasAnyUsers() {
  return getUsers().length > 0
}

export function updateUserProfile(userId, profileUpdates) {
  const users = getUsers()
  const idx = users.findIndex(u => u.id === userId)
  if (idx < 0) return null
  users[idx].profile = { ...users[idx].profile, ...profileUpdates }
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  const session = getSession()
  if (session && session.id === userId) {
    const newSession = { ...session, profile: users[idx].profile }
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession))
    if (isSupabaseConfigured()) {
      db.upsertUser(newSession).catch(console.error)
    }
    return newSession
  }
  return null
}
