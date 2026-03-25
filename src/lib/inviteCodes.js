// Invite code management — localStorage + Supabase sync
import { db, isSupabaseConfigured } from './supabase'

const CODES_KEY = 'gm_invite_codes'

function readCodes() {
  try { return JSON.parse(localStorage.getItem(CODES_KEY) || '[]') } catch { return [] }
}
function writeCodes(codes) {
  localStorage.setItem(CODES_KEY, JSON.stringify(codes))
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${seg(4)}-${seg(4)}`
}

export const inviteCodes = {
  getAll: async () => {
    if (isSupabaseConfigured()) {
      const remote = await db.getInviteCodes()
      if (remote) { writeCodes(remote); return remote }
    }
    return readCodes()
  },

  getAllLocal: () => readCodes(),

  create: async (customCode) => {
    const entry = {
      id: crypto.randomUUID(),
      code: (customCode || generateCode()).toUpperCase(),
      created_at: new Date().toISOString(),
      used: false,
      used_by: null,
      used_at: null,
    }
    writeCodes([entry, ...readCodes()])
    if (isSupabaseConfigured()) {
      db.addInviteCode(entry).catch(console.error)
    }
    return entry
  },

  delete: async (id) => {
    writeCodes(readCodes().filter(c => c.id !== id))
    if (isSupabaseConfigured()) {
      db.deleteInviteCode(id).catch(console.error)
    }
  },

  validate: async (code) => {
    // Always pull from Supabase first so fresh devices have the latest codes
    if (isSupabaseConfigured()) {
      const remote = await db.getInviteCodes()
      if (remote) writeCodes(remote)
    }
    const codes = readCodes()
    return codes.find(c => c.code.toUpperCase() === code.toUpperCase().trim() && !c.used) || null
  },

  markUsed: async (code, userEmail) => {
    const updated = readCodes().map(c =>
      c.code.toUpperCase() === code.toUpperCase().trim()
        ? { ...c, used: true, used_by: userEmail, used_at: new Date().toISOString() }
        : c
    )
    writeCodes(updated)
    if (isSupabaseConfigured()) {
      db.markInviteCodeUsed(code.toUpperCase().trim(), userEmail).catch(console.error)
    }
  },

  generate: generateCode,
}
