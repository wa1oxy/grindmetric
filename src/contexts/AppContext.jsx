import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { localStore, setStorePrefix } from '../lib/localStore'
import { setGeminiUserId } from '../lib/gemini'
import { db, isSupabaseConfigured } from '../lib/supabase'

const AppContext = createContext(null)

export function AppProvider({ user, children }) {
  setStorePrefix(user?.id)
  setGeminiUserId(user?.id)

  const [theme, setThemeState] = useState(() => localStore.getTheme())
  const [workouts, setWorkouts] = useState(() => localStore.getWorkouts())
  const [foods, setFoods] = useState(() => localStore.getFoods())
  const [weightLogs, setWeightLogs] = useState(() => localStore.getWeightLogs())
  const [photos, setPhotos] = useState(() => localStore.getPhotos())

  // On mount: sync user profile + pull latest data from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured() || !user?.id) return

    // Push user profile
    db.upsertUser(user).catch(console.error)

    // Pull latest records and update local cache + state
    Promise.all([
      db.getWorkouts(user.id),
      db.getFoods(user.id),
      db.getWeightLogs(user.id),
    ]).then(([sbWorkouts, sbFoods, sbWeightLogs]) => {
      if (sbWorkouts?.length) {
        localStore.setWorkouts(sbWorkouts)
        setWorkouts(sbWorkouts)
      }
      if (sbFoods?.length) {
        localStore.setFoods(sbFoods)
        setFoods(sbFoods)
      }
      if (sbWeightLogs?.length) {
        localStore.setWeightLogs(sbWeightLogs)
        setWeightLogs(sbWeightLogs)
      }
    }).catch(console.error)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const setTheme = (t) => { setThemeState(t); localStore.setTheme(t) }

  const addWorkout = useCallback((workout) => {
    const entry = localStore.addWorkout(workout)
    setWorkouts(localStore.getWorkouts())
    if (isSupabaseConfigured()) {
      db.addWorkout({ ...entry, user_id: user.id }).catch(console.error)
    }
    return entry
  }, [user.id])

  const deleteWorkout = useCallback((id) => {
    localStore.deleteWorkout(id)
    setWorkouts(localStore.getWorkouts())
    if (isSupabaseConfigured()) {
      db.deleteWorkout(id).catch(console.error)
    }
  }, [user.id])

  const addFood = useCallback((food) => {
    const entry = localStore.addFood(food)
    setFoods(localStore.getFoods())
    if (isSupabaseConfigured()) {
      db.addFood({ ...entry, user_id: user.id }).catch(console.error)
    }
    return entry
  }, [user.id])

  const deleteFood = useCallback((id) => {
    localStore.deleteFood(id)
    setFoods(localStore.getFoods())
    if (isSupabaseConfigured()) {
      db.deleteFood(id).catch(console.error)
    }
  }, [user.id])

  const addWeightLog = useCallback((log) => {
    const entry = localStore.addWeightLog(log)
    setWeightLogs(localStore.getWeightLogs())
    if (isSupabaseConfigured()) {
      db.addWeightLog({ ...entry, user_id: user.id }).catch(console.error)
    }
    return entry
  }, [user.id])

  const addPhoto = useCallback((photo) => {
    const entry = localStore.addPhoto(photo)
    setPhotos(localStore.getPhotos())
    return entry
  }, [])

  const updatePhoto = useCallback((id, updates) => {
    localStore.updatePhoto(id, updates)
    setPhotos(localStore.getPhotos())
  }, [])

  const deletePhoto = useCallback((id) => {
    localStore.deletePhoto(id)
    setPhotos(localStore.getPhotos())
  }, [])

  const todayStr = new Date().toISOString().split('T')[0]
  const todayWorkouts = workouts.filter(w => w.created_at.startsWith(todayStr))
  const todayFoods = foods.filter(f => f.created_at.startsWith(todayStr))
  const streak = calculateStreak(workouts)
  const todayNutrition = todayFoods.reduce(
    (acc, f) => ({ calories: acc.calories + (f.calories || 0), protein: acc.protein + (f.protein_g || 0), carbs: acc.carbs + (f.carbs_g || 0), fat: acc.fat + (f.fat_g || 0) }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const value = {
    user,
    theme, setTheme,
    workouts, addWorkout, deleteWorkout,
    foods, addFood, deleteFood,
    weightLogs, addWeightLog,
    photos, addPhoto, updatePhoto, deletePhoto,
    todayWorkouts, todayFoods, todayNutrition,
    streak,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

function calculateStreak(workouts) {
  if (!workouts.length) return 0
  const days = [...new Set(workouts.map(w => w.created_at.split('T')[0]))].sort().reverse()
  let streak = 0
  let check = new Date()
  check.setHours(0, 0, 0, 0)
  for (const day of days) {
    const d = new Date(day)
    d.setHours(0, 0, 0, 0)
    const diff = Math.round((check - d) / 86400000)
    if (diff === 0 || diff === 1) { streak++; check = d } else break
  }
  return streak
}
