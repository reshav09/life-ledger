// Calculates nutrition targets from CURRENT data every time it's called —
// nothing here is a lookup table of "weight X = target Y". If weight,
// height, goal, or activity level change, the next call reflects it.

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
};

const GOAL_CALORIE_ADJUSTMENT = {
  weight_loss: -0.15, // ~15% deficit
  weight_gain: 0.15, // ~15% surplus
  muscle_gain: 0.1,
  maintenance: 0,
  general_fitness: 0,
  improved_nutrition: 0,
  gym_prep: 0.05,
  strength_training: 0.05
};

const GOAL_PROTEIN_PER_KG = {
  weight_loss: 1.8, // higher protein on a deficit to protect muscle
  weight_gain: 1.6,
  muscle_gain: 2.0,
  maintenance: 1.4,
  general_fitness: 1.4,
  improved_nutrition: 1.4,
  gym_prep: 1.8,
  strength_training: 1.9
};

/**
 * Mifflin-St Jeor BMR, then TDEE via activity multiplier, then goal-adjusted.
 * Returns { ok:true, targets } or { ok:false, missing:[...] } if required
 * inputs aren't available — never fabricates a number for missing data (§27).
 */
function calculateNutritionTargets({ weightKg, heightCm, age, sex, activityLevel, goalType, overrides = {} }) {
  const missing = [];
  if (!weightKg) missing.push('current weight');
  if (!heightCm) missing.push('height');
  if (!age) missing.push('age (or birth year)');
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const sexOffset = sex === 'female' ? -161 : sex === 'male' ? 5 : -78; // midpoint if unspecified
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.moderate;
  const tdee = bmr * multiplier;

  const calorieAdj = GOAL_CALORIE_ADJUSTMENT[goalType] ?? 0;
  const calorieTarget = Math.round(tdee * (1 + calorieAdj));

  const proteinPerKg = GOAL_PROTEIN_PER_KG[goalType] ?? 1.4;
  const proteinTarget = Math.round(weightKg * proteinPerKg);
  const proteinCalories = proteinTarget * 4;

  const fatTarget = Math.round((calorieTarget * 0.27) / 9);
  const fatCalories = fatTarget * 9;

  const carbCalories = Math.max(calorieTarget - proteinCalories - fatCalories, 0);
  const carbTarget = Math.round(carbCalories / 4);

  const fiberTarget = Math.round((calorieTarget / 1000) * 14); // standard 14g/1000kcal guidance
  const waterTargetMl = Math.round(weightKg * 35); // ~35ml/kg baseline

  return {
    ok: true,
    basis: { bmr: Math.round(bmr), tdee: Math.round(tdee), activityLevel, goalType },
    targets: {
      calorie_target: overrides.calorie_target_override ?? calorieTarget,
      protein_target: overrides.protein_target_override ?? proteinTarget,
      carb_target: overrides.carb_target_override ?? carbTarget,
      fat_target: overrides.fat_target_override ?? fatTarget,
      fiber_target: overrides.fiber_target_override ?? fiberTarget,
      water_target_ml: overrides.water_target_ml_override ?? waterTargetMl
    },
    overridden: {
      calorie_target: overrides.calorie_target_override != null,
      protein_target: overrides.protein_target_override != null,
      carb_target: overrides.carb_target_override != null,
      fat_target: overrides.fat_target_override != null,
      fiber_target: overrides.fiber_target_override != null,
      water_target_ml: overrides.water_target_ml_override != null
    }
  };
}

module.exports = { calculateNutritionTargets, ACTIVITY_MULTIPLIERS, GOAL_CALORIE_ADJUSTMENT, GOAL_PROTEIN_PER_KG };
