// Local-first storage — per-user data keyed by userId prefix
let _prefix = ''

export function setStorePrefix(userId) {
  _prefix = userId ? `${userId}_` : ''
}

function k(name) { return `${_prefix}gm_${name}` }

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function write(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

export const localStore = {
  // Workouts
  getWorkouts: () => read(k('workouts')),
  addWorkout: (workout) => {
    const items = read(k('workouts'))
    const entry = { ...workout, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    write(k('workouts'), [entry, ...items])
    return entry
  },
  deleteWorkout: (id) => write(k('workouts'), read(k('workouts')).filter(w => w.id !== id)),

  // Foods
  getFoods: () => read(k('foods')),
  addFood: (food) => {
    const items = read(k('foods'))
    const entry = { ...food, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    write(k('foods'), [entry, ...items])
    return entry
  },
  deleteFood: (id) => write(k('foods'), read(k('foods')).filter(f => f.id !== id)),

  // Weight logs
  getWeightLogs: () => read(k('weight_logs')),
  addWeightLog: (log) => {
    const items = read(k('weight_logs'))
    const entry = { ...log, id: crypto.randomUUID(), created_at: new Date().toISOString(), log_date: new Date().toISOString().split('T')[0] }
    write(k('weight_logs'), [entry, ...items])
    return entry
  },

  // Photos
  getPhotos: () => read(k('photos')),
  addPhoto: (photo) => {
    const items = read(k('photos'))
    const entry = { ...photo, id: crypto.randomUUID(), uploaded_at: new Date().toISOString() }
    write(k('photos'), [entry, ...items])
    return entry
  },
  updatePhoto: (id, updates) => {
    const items = read(k('photos')).map(p => p.id === id ? { ...p, ...updates } : p)
    write(k('photos'), items)
  },
  deletePhoto: (id) => write(k('photos'), read(k('photos')).filter(p => p.id !== id)),

  // Settings
  getTheme: () => localStorage.getItem(k('theme')) || 'dark',
  setTheme: (t) => localStorage.setItem(k('theme'), t),
  getGeminiKey: () => localStorage.getItem('gm_gemini_key') || '', // global
  setGeminiKey: (kv) => localStorage.setItem('gm_gemini_key', kv),

  // Today helpers
  getTodayStr: () => new Date().toISOString().split('T')[0],
  getTodayWorkouts: () => {
    const today = new Date().toISOString().split('T')[0]
    return read(k('workouts')).filter(w => w.created_at.startsWith(today))
  },
  getTodayFoods: () => {
    const today = new Date().toISOString().split('T')[0]
    return read(k('foods')).filter(f => f.created_at.startsWith(today))
  },

  exportCSV: () => {
    const workouts = read(k('workouts'))
    const foods = read(k('foods'))
    const weights = read(k('weight_logs'))
    const wCSV = 'Date,Exercise,Weight(lbs),Reps,Sets\n' +
      workouts.map(w => `${w.created_at.split('T')[0]},${w.exercise},${w.weight},${w.reps},${w.sets}`).join('\n')
    const fCSV = 'Date,Food,Calories,Protein,Carbs,Fat\n' +
      foods.map(f => `${f.created_at.split('T')[0]},${f.food_name},${f.calories},${f.protein_g},${f.carbs_g},${f.fat_g}`).join('\n')
    const wgCSV = 'Date,Weight(kg)\n' +
      weights.map(w => `${w.log_date},${w.weight_kg}`).join('\n')
    return { workouts: wCSV, foods: fCSV, weights: wgCSV }
  }
}
