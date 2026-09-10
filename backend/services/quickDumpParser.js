const pool = require('../db/db');
const { callAI } = require('./aiProvider');

/**
 * Deterministic fallback parser when AI is unavailable/offline.
 * Uses pattern matching and keyword heuristics across Money, Diet, and Routine.
 */
function parseByRules(text, { accounts, categories, activities }) {
  const normalized = text.toLowerCase();
  const draft = {
    transactions: [],
    food_entries: [],
    water_ml: null,
    routine_logs: [],
    summary: 'Parsed using offline rule-based extractor'
  };

  const defaultAccount = accounts[0] || { id: 1, name: 'Default Bank' };

  // 1. Water Extraction: "2.5L water", "2500ml water", "3 liters water", "6 glasses water"
  const waterLMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:l|liters?|ltrs?)\s*(?:of\s*)?water/i);
  const waterMlMatch = normalized.match(/(\d+)\s*ml\s*(?:of\s*)?water/i);
  const waterGlassMatch = normalized.match(/(\d+)\s*glasses?\s*(?:of\s*)?water/i);

  if (waterLMatch) {
    draft.water_ml = Math.round(parseFloat(waterLMatch[1]) * 1000);
  } else if (waterMlMatch) {
    draft.water_ml = parseInt(waterMlMatch[1], 10);
  } else if (waterGlassMatch) {
    draft.water_ml = parseInt(waterGlassMatch[1], 10) * 250;
  }

  // 2. Routine Hours Extraction: "1.5h gym", "7.5 hours sleep", "2h study", "8 hrs work"
  for (const act of activities) {
    const actName = act.name.toLowerCase();
    const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:h|hrs?|hours?)\\s*(?:of\\s*)?${actName}|${actName}\\s*(?:for\\s*)?(\\d+(?:\\.\\d+)?)\\s*(?:h|hrs?|hours?)`, 'i');
    const match = normalized.match(regex);
    if (match) {
      const hours = parseFloat(match[1] || match[2]);
      if (!isNaN(hours) && hours > 0) {
        draft.routine_logs.push({
          activity_id: act.id,
          activity_name: act.name,
          hours: Math.min(24, hours),
          notes: ''
        });
      }
    }
  }

  // 3. Money Spend Extraction: "spent 120 on rapido", "paid 250 for food", "150 rs cab", "₹300 groceries"
  const spendRegexes = [
    /(?:spent|paid|spend|cost)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:on|for|to)?\s*([a-z0-9\s-]+?)(?:,|\.|\band\b|$)/gi,
    /(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*(?:for|on)?\s*([a-z0-9\s-]+?)(?:,|\.|\band\b|$)/gi,
    /([a-z0-9\s-]+?)\s*(?:for|cost|was)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)(?:,|\.|\band\b|$)/gi
  ];

  for (const regex of spendRegexes) {
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      let amount = parseFloat(match[1]);
      let item = (match[2] || '').trim();

      // Handle reversed order in 3rd regex
      if (isNaN(amount) && !isNaN(parseFloat(match[2]))) {
        amount = parseFloat(match[2]);
        item = (match[1] || '').trim();
      }

      if (!isNaN(amount) && amount > 0 && item.length > 1) {
        // Find best matching category
        let matchedCat = categories.find((c) => item.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(item));
        if (!matchedCat) {
          if (/cab|uber|rapido|ola|auto|travel|bus|train|petrol|fuel/i.test(item)) {
            matchedCat = categories.find((c) => /travel|rapido|cab|fuel/i.test(c.name)) || categories[0];
          } else if (/food|swiggy|zomato|burger|pizza|biryani|chai|tea|coffee|lunch|dinner|breakfast/i.test(item)) {
            matchedCat = categories.find((c) => /food|fast food/i.test(c.name)) || categories[0];
          } else if (/bill|recharge|wifi|electricity|rent/i.test(item)) {
            matchedCat = categories.find((c) => /bill|rent/i.test(c.name)) || categories[0];
          } else {
            matchedCat = categories.find((c) => c.name.toLowerCase() === 'misc') || categories[0];
          }
        }

        // Find matched account if mentioned
        let matchedAcc = accounts.find((a) => normalized.includes(a.name.toLowerCase()) || (a.bank_name && normalized.includes(a.bank_name.toLowerCase())));
        if (!matchedAcc) matchedAcc = defaultAccount;

        // Avoid duplicate
        if (!draft.transactions.some((t) => t.amount === amount && t.description.toLowerCase() === item)) {
          draft.transactions.push({
            account_id: matchedAcc.id,
            account_name: matchedAcc.name,
            category_id: matchedCat.id,
            category_name: matchedCat.name,
            amount: Number(amount.toFixed(2)),
            type: 'expense',
            description: item.charAt(0).toUpperCase() + item.slice(1)
          });
        }
      }
    }
  }

  // 4. Food Entry Extraction: "had 4 boiled eggs and 2 rotis with dal for lunch"
  const foodKeywords = ['ate', 'had', 'consumed', 'breakfast', 'lunch', 'dinner', 'snack', 'shake', 'eggs', 'chicken', 'roti', 'rice', 'dal', 'paneer', 'oats', 'whey'];
  if (foodKeywords.some((k) => normalized.includes(k))) {
    const mealType = normalized.includes('breakfast') ? 'breakfast'
                   : normalized.includes('dinner') ? 'dinner'
                   : normalized.includes('snack') ? 'snack'
                   : normalized.includes('lunch') ? 'lunch'
                   : 'other';

    // Extract food segment
    const foodMatch = normalized.match(/(?:had|ate|consumed|for (?:breakfast|lunch|dinner|snack))\s*:?\s*([^.,]+)/i);
    const desc = foodMatch ? foodMatch[1].trim() : text.trim();

    if (desc && desc.length > 2) {
      draft.food_entries.push({
        meal_type: mealType,
        description: desc.charAt(0).toUpperCase() + desc.slice(1),
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        fiber_g: null
      });
    }
  }

  return draft;
}

/**
 * Main parser function: tries AI parsing with context first; falls back gracefully to rule-based regex parser.
 */
async function parseQuickDump(text, settings, targetDate) {
  const [accounts] = await pool.query('SELECT id, name, bank_name FROM accounts WHERE is_active = 1');
  const [categories] = await pool.query('SELECT id, name, type FROM categories WHERE type="expense"');
  const [activities] = await pool.query('SELECT id, name FROM routine_activities WHERE is_active = 1');

  const contextData = { accounts, categories, activities };

  // If AI provider is active, run the LLM extractor
  if (settings && settings.active_provider) {
    const systemPrompt = `You are an expert multi-ledger intent parser for a personal life and finance tracker.
You will receive raw natural-language text entered by the user recounting their day (spends, meals, water, routine/workout hours).

Extract all items accurately into this exact JSON format:
{
  "transactions": [
    {
      "account_id": <matching id from accounts list or first account id>,
      "account_name": "<name>",
      "category_id": <matching id from categories list>,
      "category_name": "<name>",
      "amount": <number>,
      "type": "expense",
      "description": "<clean short description>"
    }
  ],
  "food_entries": [
    {
      "meal_type": "breakfast" | "lunch" | "dinner" | "snack" | "drink" | "supplement" | "other",
      "description": "<food name and quantity>",
      "calories": <estimated integer calories or null>,
      "protein_g": <estimated integer grams or null>,
      "carbs_g": <estimated integer grams or null>,
      "fat_g": <estimated integer grams or null>,
      "fiber_g": <estimated integer grams or null>
    }
  ],
  "water_ml": <integer total ml of water mentioned, or null if none>,
  "routine_logs": [
    {
      "activity_id": <matching id from routine_activities list>,
      "activity_name": "<activity name>",
      "hours": <number of hours, e.g. 1.5>,
      "notes": "<optional short note>"
    }
  ],
  "summary": "<1-sentence summary of what was parsed>"
}

Available Accounts:
${JSON.stringify(accounts.map((a) => ({ id: a.id, name: a.name, bank: a.bank_name })))}

Available Expense Categories:
${JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name })))}

Available Routine Activities:
${JSON.stringify(activities.map((a) => ({ id: a.id, name: a.name })))}

Rules:
1. Output ONLY a single valid JSON object. No markdown code blocks, no backticks, no explanations.
2. If something is not mentioned, return empty array [] or null for water.
3. Map category_id and activity_id strictly to the provided IDs.
4. Estimate realistic macros for food items if recognizable (e.g. 4 boiled eggs = ~280 kcal, 24g protein).`;

    try {
      const aiResult = await callAI(settings, {
        system: systemPrompt,
        messages: [{ role: 'user', content: text }]
      });

      if (aiResult.ok && aiResult.text) {
        let cleaned = aiResult.text.trim();
        // Strip markdown code fences if AI returned them
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        }
        const parsed = JSON.parse(cleaned);
        return {
          ok: true,
          draft: {
            transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
            food_entries: Array.isArray(parsed.food_entries) ? parsed.food_entries : [],
            water_ml: typeof parsed.water_ml === 'number' ? parsed.water_ml : null,
            routine_logs: Array.isArray(parsed.routine_logs) ? parsed.routine_logs : [],
            summary: parsed.summary || 'Parsed via AI Analyzer'
          },
          parsed_by: 'ai',
          provider_used: aiResult.provider
        };
      }
    } catch (err) {
      console.warn('AI Quick Dump parsing failed, falling back to rule parser:', err.message);
    }
  }

  // Offline / rule-based fallback
  const draft = parseByRules(text, contextData);
  return {
    ok: true,
    draft,
    parsed_by: 'rules'
  };
}

module.exports = { parseQuickDump, parseByRules };
