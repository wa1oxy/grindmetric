// Seeds realistic demo data on first load so the app looks alive
import { localStore } from './localStore'

const SEED_KEY = 'gm_seeded_v2'

export function seedDemoData() {
  if (localStorage.getItem(SEED_KEY)) return

  const now = new Date()
  const daysAgo = (n, h = 10, m = 0) => {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }

  // Seed workouts (last 10 days, skipping a couple)
  const workouts = [
    { exercise: 'Bench Press', weight: 185, reps: 8, sets: 4, created_at: daysAgo(0, 8) },
    { exercise: 'OHP',         weight: 115, reps: 6, sets: 3, created_at: daysAgo(0, 8, 20) },
    { exercise: 'Squat',       weight: 225, reps: 5, sets: 5, created_at: daysAgo(2, 7) },
    { exercise: 'RDL',         weight: 185, reps: 8, sets: 3, created_at: daysAgo(2, 7, 25) },
    { exercise: 'Bench Press', weight: 180, reps: 8, sets: 4, created_at: daysAgo(3, 9) },
    { exercise: 'Rows',        weight: 155, reps: 10, sets: 3, created_at: daysAgo(3, 9, 20) },
    { exercise: 'Deadlift',    weight: 275, reps: 5, sets: 3, created_at: daysAgo(5, 8) },
    { exercise: 'Pull-ups',    weight: 0,   reps: 10, sets: 4, created_at: daysAgo(5, 8, 20) },
    { exercise: 'Bench Press', weight: 175, reps: 8, sets: 4, created_at: daysAgo(7, 9) },
    { exercise: 'Curls',       weight: 45,  reps: 12, sets: 3, created_at: daysAgo(7, 9, 20) },
    { exercise: 'Squat',       weight: 215, reps: 6, sets: 4, created_at: daysAgo(9, 8) },
    { exercise: 'OHP',         weight: 110, reps: 6, sets: 3, created_at: daysAgo(9, 8, 20) },
  ]

  // Seed foods (today)
  const foods = [
    { food_name: 'Oats', calories: 307, protein_g: 11, carbs_g: 55, fat_g: 5, created_at: daysAgo(0, 7) },
    { food_name: 'Protein Shake', calories: 150, protein_g: 25, carbs_g: 8, fat_g: 3, created_at: daysAgo(0, 7, 30) },
    { food_name: 'Chicken Breast', calories: 374, protein_g: 70, carbs_g: 0, fat_g: 8, created_at: daysAgo(0, 12) },
    { food_name: 'White Rice', calories: 412, protein_g: 8, carbs_g: 90, fat_g: 0, created_at: daysAgo(0, 12, 5) },
  ]

  // Seed weight logs
  const weights = [
    { weight_kg: 78.2, created_at: daysAgo(0), log_date: daysAgo(0).split('T')[0] },
    { weight_kg: 78.5, created_at: daysAgo(2), log_date: daysAgo(2).split('T')[0] },
    { weight_kg: 78.8, created_at: daysAgo(4), log_date: daysAgo(4).split('T')[0] },
    { weight_kg: 79.1, created_at: daysAgo(7), log_date: daysAgo(7).split('T')[0] },
    { weight_kg: 79.4, created_at: daysAgo(10), log_date: daysAgo(10).split('T')[0] },
  ]

  // Write all using IDs
  const existing = { workouts: [], foods: [], weightLogs: [] }
  workouts.forEach(w => {
    const items = JSON.parse(localStorage.getItem('gm_workouts') || '[]')
    items.push({ ...w, id: crypto.randomUUID() })
    localStorage.setItem('gm_workouts', JSON.stringify(items))
  })
  foods.forEach(f => {
    const items = JSON.parse(localStorage.getItem('gm_foods') || '[]')
    items.push({ ...f, id: crypto.randomUUID() })
    localStorage.setItem('gm_foods', JSON.stringify(items))
  })
  weights.forEach(w => {
    const items = JSON.parse(localStorage.getItem('gm_weight_logs') || '[]')
    items.push({ ...w, id: crypto.randomUUID() })
    localStorage.setItem('gm_weight_logs', JSON.stringify(items))
  })

  localStorage.setItem(SEED_KEY, '1')
}
