// Pure, deterministic analysis over the structured context — no network
// call, no API key needed. This is what keeps §41 true: the app's core
// insight generation never depends on an external AI service being up.

function fmt(n, d = 0) {
  return Number(n || 0).toFixed(d);
}

function dailyAnalysis(ctx) {
  const lines = [];
  const t = ctx.today.totals;
  const targets = ctx.nutrition_targets;

  if (!targets.ok) {
    return `Not enough profile data yet to set nutrition targets. Missing: ${targets.missing.join(', ')}. Add these in your Health Profile for a personalized daily analysis.`;
  }

  const remaining = {
    protein: targets.targets.protein_target - t.protein_g,
    calories: targets.targets.calorie_target - t.calories
  };

  lines.push(`Calories: ${fmt(t.calories)} / ${targets.targets.calorie_target} kcal.`);
  lines.push(`Protein: ${fmt(t.protein_g)}g / ${targets.targets.protein_target}g.`);

  if (remaining.protein > 15) {
    lines.push(`Protein is currently below your target — you have about ${fmt(remaining.protein)}g remaining today.`);
  } else if (remaining.protein < -10) {
    lines.push(`You're already ${fmt(Math.abs(remaining.protein))}g over your protein target today.`);
  } else {
    lines.push(`Protein is on track for today.`);
  }

  if (ctx.today.food_entries.some((e) => e.data_source === 'ai_estimated')) {
    lines.push(`Note: some of today's entries use AI-estimated nutrition values rather than confirmed figures.`);
  }

  return lines.join(' ');
}

function weeklyInsight(ctx) {
  if (!ctx.weekly_nutrition_average || ctx.weekly_nutrition_average.days_logged < 3) {
    return 'Not enough data yet to establish a reliable weekly trend — log food on at least 3 days this week for a meaningful comparison.';
  }
  const w = ctx.weekly_nutrition_average;
  const lines = [`Logged on ${w.days_logged} day(s) this week, averaging ${w.avg_calories} kcal and ${w.avg_protein_g}g protein per logged day.`];
  if (ctx.nutrition_targets.ok) {
    const gap = ctx.nutrition_targets.targets.protein_target - w.avg_protein_g;
    if (gap > 10) lines.push(`That's ${fmt(gap)}g/day short of your current protein target on average.`);
  }
  return lines.join(' ');
}

function weightTrendPrediction(ctx) {
  const trend = ctx.weight_trend;
  if (trend.length < 3) {
    return {
      text: 'Not enough recorded weight measurements yet for a reliable trend — at least 3 dated entries are needed.',
      data_used: trend
    };
  }
  const first = trend[0];
  const last = trend[trend.length - 1];
  const days = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24);
  if (days < 3) {
    return { text: 'Recorded weight entries are too close together in time for a reliable trend yet.', data_used: trend };
  }
  const changeTotal = Number(last.value) - Number(first.value);
  const perWeek = (changeTotal / days) * 7;
  const direction = perWeek > 0.05 ? 'upward' : perWeek < -0.05 ? 'downward' : 'stable';
  return {
    text: `Based on ${trend.length} recorded measurement(s) from ${first.date} to ${last.date}, weight is trending ${direction} at approximately ${perWeek >= 0 ? '+' : ''}${fmt(perWeek, 2)} kg/week. This is an observed trend from the data you've logged, not a guaranteed future outcome.`,
    data_used: trend,
    trend_kg_per_week: Number(perWeek.toFixed(2))
  };
}

function suggestions(ctx) {
  const list = [];

  if (ctx.nutrition_targets.ok) {
    const t = ctx.today.totals;
    const targets = ctx.nutrition_targets.targets;
    if (targets.protein_target - t.protein_g > 15) {
      list.push({
        text: 'Increase protein intake for the rest of today to close the gap to your target.',
        why: [`Today's protein so far: ${fmt(t.protein_g)}g`, `Current target: ${targets.protein_target}g`]
      });
    }
  }

  const gymToday = ctx.today.schedule.find((s) => /gym/i.test(s.activity_name));
  if (gymToday) {
    list.push({
      text: `Your schedule has ${gymToday.activity_name} at ${gymToday.start_time} today — consider planning a meal or snack beforehand.`,
      why: [`Scheduled: ${gymToday.activity_name} at ${gymToday.start_time}–${gymToday.end_time}`]
    });
  }

  if (ctx.finance_snapshot && ctx.gym_money_this_month) {
    const surplus = ctx.finance_snapshot.monthly_surplus;
    if (surplus != null && surplus < 3000 && ctx.gym_money_this_month.unclassified > 0) {
      list.push({
        text: `Your recent spending leaves a relatively tight monthly surplus. There's also ₹${fmt(ctx.gym_money_this_month.unclassified)} in unclassified gym spending worth reviewing before planning new purchases.`,
        why: [`Monthly surplus: ₹${fmt(surplus)}`, `Unclassified gym spending: ₹${fmt(ctx.gym_money_this_month.unclassified)}`]
      });
    }
  }

  if (ctx.latest_health_measurements.length > 0) {
    list.push({
      text: 'You have recent health measurements on file — review the Health Profile page for anything outside its stated reference range and consider discussing it with a healthcare professional.',
      why: ctx.latest_health_measurements.map((m) => `${m.measurement_type}: ${m.value}${m.unit} (ref: ${m.reference_range || 'n/a'})`)
    });
  }

  if (list.length === 0) {
    list.push({ text: 'Not enough data yet to generate personalized suggestions — log a few days of food and weight to get started.', why: [] });
  }

  return list;
}

module.exports = { dailyAnalysis, weeklyInsight, weightTrendPrediction, suggestions };
