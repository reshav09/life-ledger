/**
 * Script to map verified ATS platforms (Greenhouse, Lever, Ashby, SmartRecruiters)
 * to organizations in jobhunt_organizations table.
 */

const pool = require('../db/db');

const VERIFIED_ATS_MAPPINGS = [
  // Greenhouse
  { id: 272, name: 'Airbnb', ats_type: 'greenhouse', ats_id: 'airbnb' },
  { id: 260, name: 'Akuna Capital', ats_type: 'greenhouse', ats_id: 'akunacapital' },
  { id: 178, name: 'Anthropic', ats_type: 'greenhouse', ats_id: 'anthropic' },
  { id: 325, name: 'AppLovin', ats_type: 'greenhouse', ats_id: 'applovin' },
  { id: 284, name: 'Asana', ats_type: 'greenhouse', ats_id: 'asana' },
  { id: 273, name: 'Block (Square)', ats_type: 'greenhouse', ats_id: 'block' },
  { id: 141, name: 'Canonical', ats_type: 'greenhouse', ats_id: 'canonical' },
  { id: 184, name: 'Cloudflare', ats_type: 'greenhouse', ats_id: 'cloudflare' },
  { id: 153, name: 'Coinbase', ats_type: 'greenhouse', ats_id: 'coinbase' },
  { id: 285, name: 'Coupang', ats_type: 'greenhouse', ats_id: 'coupang' },
  { id: 286, name: 'Datadog', ats_type: 'greenhouse', ats_id: 'datadog' },
  { id: 296, name: 'Discord', ats_type: 'greenhouse', ats_id: 'discord' },
  { id: 292, name: 'Dropbox', ats_type: 'greenhouse', ats_id: 'dropbox' },
  { id: 295, name: 'Figma', ats_type: 'greenhouse', ats_id: 'figma' },
  { id: 175, name: 'IMC Trading', ats_type: 'greenhouse', ats_id: 'imc' },
  { id: 167, name: 'Jane Street', ats_type: 'greenhouse', ats_id: 'janestreet' },
  { id: 169, name: 'Jump Trading', ats_type: 'greenhouse', ats_id: 'jumptrading' },
  { id: 290, name: 'LinkedIn', ats_type: 'greenhouse', ats_id: 'linkedin' },
  { id: 308, name: 'Lyft', ats_type: 'greenhouse', ats_id: 'lyft' },
  { id: 165, name: 'PDT Partners', ats_type: 'greenhouse', ats_id: 'pdtpartners' },
  { id: 293, name: 'Pinterest', ats_type: 'greenhouse', ats_id: 'pinterest' },
  { id: 236, name: 'Point72', ats_type: 'greenhouse', ats_id: 'point72' },
  { id: 145, name: 'Proton AG', ats_type: 'greenhouse', ats_id: 'proton' },
  { id: 241, name: 'Quadrature Capital', ats_type: 'greenhouse', ats_id: 'quadraturecapital' },
  { id: 297, name: 'Robinhood', ats_type: 'greenhouse', ats_id: 'robinhood' },
  { id: 266, name: 'Roblox', ats_type: 'greenhouse', ats_id: 'roblox' },
  { id: 150, name: 'Rubrik India', ats_type: 'greenhouse', ats_id: 'rubrik' },
  { id: 248, name: 'Schonfeld Strategic Advisors', ats_type: 'greenhouse', ats_id: 'schonfeld' },
  { id: 259, name: 'Squarepoint Capital', ats_type: 'greenhouse', ats_id: 'squarepointcapital' },
  { id: 183, name: 'Stripe', ats_type: 'greenhouse', ats_id: 'stripe' },
  { id: 124, name: 'Stripe Europe', ats_type: 'greenhouse', ats_id: 'stripe' },
  { id: 289, name: 'The Trade Desk', ats_type: 'greenhouse', ats_id: 'thetradedesk' },
  { id: 170, name: 'Tower Research Capital', ats_type: 'greenhouse', ats_id: 'towerresearchcapital' },
  { id: 309, name: 'Twitch', ats_type: 'greenhouse', ats_id: 'twitch' },
  { id: 261, name: 'VivCourt Trading', ats_type: 'greenhouse', ats_id: 'vivcourt' },
  { id: 174, name: 'WorldQuant', ats_type: 'greenhouse', ats_id: 'worldquant' },

  // Lever
  { id: 182, name: 'Palantir Technologies', ats_type: 'lever', ats_id: 'palantir' },

  // Ashby
  { id: 283, name: 'Notion', ats_type: 'ashby', ats_id: 'notion' },
  { id: 177, name: 'OpenAI', ats_type: 'ashby', ats_id: 'openai' },
  { id: 294, name: 'Plaid', ats_type: 'ashby', ats_id: 'plaid' },
  { id: 181, name: 'Ramp', ats_type: 'ashby', ats_id: 'ramp' },

  // SmartRecruiters
  { id: 288, name: 'Bytedance', ats_type: 'smartrecruiters', ats_id: 'bytedance' },
  { id: 132, name: 'ByteDance Singapore', ats_type: 'smartrecruiters', ats_id: 'bytedance' },
  { id: 121, name: 'Delivery Hero', ats_type: 'smartrecruiters', ats_id: 'deliveryhero' },
  { id: 130, name: 'Grab', ats_type: 'smartrecruiters', ats_id: 'grab' },
  { id: 107, name: 'Swiggy', ats_type: 'smartrecruiters', ats_id: 'swiggy' },
  { id: 276, name: 'Uber', ats_type: 'smartrecruiters', ats_id: 'uber' },
  { id: 103, name: 'Uber India', ats_type: 'smartrecruiters', ats_id: 'uber' }
];

async function syncATSOrgs(dbPool = pool) {
  let updated = 0;
  for (const mapping of VERIFIED_ATS_MAPPINGS) {
    const [res] = await dbPool.query(
      `UPDATE jobhunt_organizations 
       SET ats_type = ?, ats_id = ? 
       WHERE id = ? OR name = ?`,
      [mapping.ats_type, mapping.ats_id, mapping.id, mapping.name]
    );
    if (res.affectedRows > 0) updated++;
  }
  console.log(`Configured ${updated} organizations with verified ATS JSON connectors.`);
  return updated;
}

if (require.main === module) {
  syncATSOrgs()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error syncing ATS orgs:', err);
      process.exit(1);
    });
}

module.exports = { syncATSOrgs, VERIFIED_ATS_MAPPINGS };
