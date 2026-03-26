/**
 * Calculate personalized daily nutrition targets based on user profile.
 * Uses Mifflin-St Jeor BMR + activity multiplier + goal adjustment.
 */
export function calculateNutritionGoals(profile = {}) {
  const weight = parseFloat(profile.weight) || 70   // kg
  const height = parseFloat(profile.height) || 170  // cm
  const age    = parseInt(profile.age)    || 25
  const sex    = (profile.sex || 'male').toLowerCase()

  // Mifflin-St Jeor BMR
  const bmr = sex === 'female'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5

  // Activity multiplier based on days/week
  const days = profile.daysPerWeek || 3
  const multiplier =
    days <= 1 ? 1.2 :
    days <= 3 ? 1.375 :
    days <= 5 ? 1.55 :
    1.725

  const tdee = Math.round(bmr * multiplier)

  // Goal-based calorie adjustment
  const goal = (profile.goal || '').toLowerCase()
  let calories
  if      (goal.includes('lose') || goal.includes('fat'))               calories = Math.round(tdee - 350)
  else if (goal.includes('muscle') || goal.includes('build') || goal.includes('bulk')) calories = Math.round(tdee + 250)
  else if (goal.includes('stronger') || goal.includes('strength'))       calories = Math.round(tdee + 100)
  else                                                                   calories = tdee

  calories = Math.max(calories, 1200) // floor

  // Macros — protein first, fill the rest with carbs/fat
  const protein = Math.round(weight * 2.0)           // ~2g/kg bodyweight
  const fat     = Math.round((calories * 0.27) / 9)  // 27% of cals from fat
  const carbs   = Math.max(Math.round((calories - protein * 4 - fat * 9) / 4), 50)

  return { calories, protein, carbs, fat }
}
