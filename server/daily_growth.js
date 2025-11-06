// Daily Growth & Mutation Logic Script for Sharboretum
// Runs once per day to:
//  1) Iterate through Sharbor table
//  2) Use owner's mutation_score from Users table to determine randomized mutation boost
//  3) Calculate and update new growth_progress in Sharbor table
//  4) Reset all users' mutation_score to zero

const path = require('path');

// Load env if present (optional)
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
  // dotenv not required; continue
}

const { init, all, get, run } = require('./db');

function randomInt(min, max) {
  // inclusive min/max
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Computes daily growth increment and whether a mutation boost applies.
 * - Base growth increment can be configured via DAILY_BASE_GROWTH env (default: 1)
 * - Mutation probability scales with owner's mutation_score:
 *      prob = clamp(mutation_score / 100, 0, 0.5) // up to 50% chance
 * - Mutation boost amount is randomized between 2 and 8 inclusive when it triggers.
 *
 * Returns: { increment: number, newGrowth: number, didBoost: boolean }
 */
function computeDailyUpdate(mutationScore, currentGrowth) {
  const baseInc = Number(process.env.DAILY_BASE_GROWTH || 1);

  const score = Math.max(0, Number(mutationScore) || 0);
  const prob = Math.min(0.5, score / 100);

  const didBoost = Math.random() < prob;
  const boost = didBoost ? randomInt(2, 8) : 0;

  const increment = baseInc + boost;
  const newGrowth = Number(currentGrowth || 0) + increment;

  return { increment, newGrowth, didBoost };
}

async function processSharbors() {
  await init();

  // Fetch all sharbors
  const sharbors = await all(
    `SELECT nft_address, owner_address, growth_progress, health_status
     FROM sharbors`
  );

  if (!sharbors || sharbors.length === 0) {
    // Still reset mutation scores even if no sharbors present
    await run(`UPDATE users SET mutation_score = 0 WHERE mutation_score != 0`);
    return { count: 0, boostedCount: 0, totalIncrement: 0 };
  }

  let boostedCount = 0;
  let totalIncrement = 0;

  for (const s of sharbors) {
    // Get owner's mutation score
    const owner = await get(
      `SELECT mutation_score FROM users WHERE ton_address = ?`,
      [s.owner_address]
    );
    const mutationScore = owner ? owner.mutation_score : 0;

    // Compute daily update
    const { increment, newGrowth, didBoost } = computeDailyUpdate(
      mutationScore,
      s.growth_progress
    );

    totalIncrement += increment;
    if (didBoost) boostedCount++;

    // Persist new growth_progress
    await run(
      `UPDATE sharbors
       SET growth_progress = ?
       WHERE nft_address = ?`,
      [newGrowth, s.nft_address]
    );
  }

  // Reset all users' mutation_score after processing
  await run(`UPDATE users SET mutation_score = 0 WHERE mutation_score != 0`);

  return { count: sharbors.length, boostedCount, totalIncrement };
}

(async () => {
  try {
    const result = await processSharbors();
    console.log(
      JSON.stringify(
        {
          updatedSharbors: result.count,
          boostedSharbors: result.boostedCount,
          totalGrowthIncrement: result.totalIncrement,
          ts: Math.floor(Date.now() / 1000),
        },
        null,
        2
      )
    );
    process.exit(0);
  } catch (err) {
    console.error('Daily growth job failed:', err);
    process.exit(1);
  }
})();
