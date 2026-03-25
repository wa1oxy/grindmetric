import { createContext, useContext, useState, useCallback } from 'react'
import { localStore, setStorePrefix } from '../lib/localStore'
import { setGeminiUserId } from '../lib/gemini'

const AppContext = createContext(null)

export function AppProvider({ user, children }) {
  // Set per-user storage + AI cache prefix immediately
  setStorePrefix(user?.id)
  setGeminiUserId(user?.id)

  const [theme, setThemeState] = useState(() => localStore.getTheme())
  const [workouts, setWorkouts] = useState(() => localStore.getWorkouts())
  const [foods, setFoods] = useState(() => localStore.getFoods())
  const [weightLogs, setWeightLogs] = useState(() => localStore.getWeightLogs())
  const [photos, setPhotos] = useState(() => localStore.getPhotos())

  const setTheme = (t) => { setThemeState(t); localStore.setTheme(t) }

  const addWorkout = useCallback((workout) => {
    const entry = localStore.addWorkout(workout)
    setWorkouts(localStore.getWorkouts())
    return entry
  }, [])

  const deleteWorkout = useCallback((id) => {
    localStore.deleteWorkout(id)
    setWorkouts(localStore.getWorkouts())
  }, [])

  const addFood = useCallback((food) => {
    const entry = localStore.addFood(food)
    setFoods(localStore.getFoods())
    return entry
  }, [])

  const deleteFood = useCallback((id) => {
    localStore.deleteFood(id)
    setFoods(localStore.getFoods())
  }, [])

  const addWeightLog = useCallback((log) => {
    const entry = localStore.addWeightLog(log)
    setWeightLogs(localStore.getWeightLogs())
    return entry
  }, [])

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
