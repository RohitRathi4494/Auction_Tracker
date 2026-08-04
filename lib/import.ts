import { Player, Team, Tier, AgeBracket } from '@/types';

// ─── Category derivation ─────────────────────────────────────────────────────
export function deriveTier(rawCategory: string): Tier {
  return rawCategory.endsWith('A') ? 'A' : 'B';
}

export function deriveAgeBracket(rawCategory: string): AgeBracket {
  return rawCategory.startsWith('U35') ? 'under_35' : 'above_35';
}

export function deriveBasePrice(tier: Tier): number {
  return tier === 'A' ? 15000 : 5000;
}

// ─── Parse bowlingStyles JSON string ─────────────────────────────────────────
function parseBowlingStyles(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Safe number helper ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeNum(val: any, decimals = 2): number | undefined {
  const n = parseFloat(String(val ?? ''));
  if (isNaN(n)) return undefined;
  return parseFloat(n.toFixed(decimals));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeInt(val: any): number | undefined {
  const n = parseInt(String(val ?? ''), 10);
  return isNaN(n) ? undefined : n;
}

// ─── Parse "Best Bowling" — stored as a number like 46082 meaning "4/60" (4 wkts, 82 runs encoded) ──
// CricHeroes encodes best bowling as: wickets * 10000 + runs (e.g. 46082 = 4 wkts / 82 runs... or it might just be a raw number)
// We'll store it as a string "4/82" for display
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBestBowling(val: any): string | undefined {
  if (!val) return undefined;
  const str = String(val).trim();
  // If it already looks like "4/82" format, return as-is
  if (str.includes('/')) return str;
  // If it's a raw number like 46082: first digit(s) = wickets, remaining = runs
  // But this encoding isn't standard — store as raw string for safety
  return str;
}

// ─── Map Excel row → Player object ───────────────────────────────────────────
// The full SSCL registration Excel has 48 columns with complete CricHeroes stats.
// Columns I–AV contain batting, bowling, fielding stats scraped from CricHeroes.
// We import them all here so the app never needs to re-scrape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRowToPlayer(row: Record<string, any>, index: number): Omit<Player, 'id'> {
  const rawCategory = String(row.category || '');
  const tier = deriveTier(rawCategory);
  const ageBracket = deriveAgeBracket(rawCategory);

  // ── Batting stats (from Excel columns I–W) ────────────────────────────────
  const battingMatches  = safeInt(row['batting_matches']);
  const battingInnings  = safeInt(row['batting_innings']);
  const notOut          = safeInt(row['not_out']);
  const battingRuns     = safeInt(row['batting_runs']);
  const highestScore    = safeInt(row['highest_runs']);
  const battingAvg      = safeNum(row['Batting Avg']);
  const strikeRate      = safeNum(row['Batting SR']);
  const thirties        = safeInt(row['30s']);
  const fifties         = safeInt(row['50s']);
  const hundreds        = safeInt(row['100s']);
  const fours           = safeInt(row['bating_4s']);
  const sixes           = safeInt(row['bating_6s']);
  const ducks           = safeInt(row['ducks']);

  // ── Bowling stats (from Excel columns X–AN) ───────────────────────────────
  const bowlingMatches  = safeInt(row['bowling_matches']);
  const bowlingInnings  = safeInt(row['bowling_innings']);
  const overs           = safeNum(row['overs'], 1);
  const maidens         = safeInt(row['maidens']);
  const careerWickets   = safeInt(row['Wickets']);
  const bowlingRuns     = safeInt(row['bowling_runs']);
  const bestBowling     = parseBestBowling(row['Best Bowling']);
  const threeWickets    = safeInt(row['3_wickets']);
  const fiveWickets     = safeInt(row['5_wickets']);
  const economy         = safeNum(row['Economy']);
  const bowlingSR       = safeNum(row['bowling_sr']);
  const bowlingAvg      = safeNum(row['bowling_avg']);
  const wides           = safeInt(row['wides']);
  const noBalls         = safeInt(row['noballs']);
  const dotBalls        = safeInt(row['dot_balls']);

  // ── Fielding stats (from Excel columns AO–AV) ────────────────────────────
  const totalMatches    = safeInt(row['Matches']);
  const caughtBehind    = safeInt(row['Caught behind']);
  const runOuts         = safeInt(row['Run outs']);
  const stumpings       = safeInt(row['Stumpings']);
  const assistedRunOuts = safeInt(row['Assisted Run Outs']);
  const byeRuns         = safeInt(row['Bye Runs (WK)']);
  const catches         = safeInt(row['Catches']);
  const skillLabel      = String(row['skill'] || '').trim() || undefined;

  // ── Has stats? Flag so UI knows data came from Excel (not scraper) ─────────
  const hasExcelStats = battingAvg !== undefined || careerWickets !== undefined;

  return {
    fullName:      String(row.fullName || '').trim(),
    phone:         String(row.phone || '').trim(),
    age:           parseFloat(String(row.age)) || 0,
    playingAs:     String(row.playingAs || '').trim(),
    battingStyle:  String(row.battingStyle || '').trim(),
    bowlingStyles: parseBowlingStyles(String(row.bowlingStyles || '[]')),
    cricHeroesUrl: String(row.cricHeroesProfile || '').trim(),
    rawCategory,
    tier,
    ageBracket,
    basePrice: deriveBasePrice(tier),
    status: 'available',

    // ── Career stats from Excel ──────────────────────────────────────────────
    ...(battingAvg      !== undefined && { battingAvg }),
    ...(strikeRate      !== undefined && { strikeRate }),
    ...(careerWickets   !== undefined && { careerWickets }),
    ...(economy         !== undefined && { economy }),

    // ── Extended batting ─────────────────────────────────────────────────────
    ...(battingMatches  !== undefined && { battingMatches }),
    ...(battingInnings  !== undefined && { battingInnings }),
    ...(notOut          !== undefined && { notOut }),
    ...(battingRuns     !== undefined && { battingRuns }),
    ...(highestScore    !== undefined && { highestScore }),
    ...(thirties        !== undefined && { thirties }),
    ...(fifties         !== undefined && { fifties }),
    ...(hundreds        !== undefined && { hundreds }),
    ...(fours           !== undefined && { fours }),
    ...(sixes           !== undefined && { sixes }),
    ...(ducks           !== undefined && { ducks }),

    // ── Extended bowling ─────────────────────────────────────────────────────
    ...(bowlingMatches  !== undefined && { bowlingMatches }),
    ...(bowlingInnings  !== undefined && { bowlingInnings }),
    ...(overs           !== undefined && { overs }),
    ...(maidens         !== undefined && { maidens }),
    ...(bowlingRuns     !== undefined && { bowlingRuns }),
    ...(bestBowling     !== undefined && { bestBowling }),
    ...(threeWickets    !== undefined && { threeWickets }),
    ...(fiveWickets     !== undefined && { fiveWickets }),
    ...(bowlingSR       !== undefined && { bowlingSR }),
    ...(bowlingAvg      !== undefined && { bowlingAvg }),
    ...(wides           !== undefined && { wides }),
    ...(noBalls         !== undefined && { noBalls }),
    ...(dotBalls        !== undefined && { dotBalls }),

    // ── Fielding / general ───────────────────────────────────────────────────
    ...(totalMatches    !== undefined && { totalMatches }),
    ...(caughtBehind    !== undefined && { caughtBehind }),
    ...(runOuts         !== undefined && { runOuts }),
    ...(stumpings       !== undefined && { stumpings }),
    ...(assistedRunOuts !== undefined && { assistedRunOuts }),
    ...(byeRuns         !== undefined && { byeRuns }),
    ...(catches         !== undefined && { catches }),
    ...(skillLabel      !== undefined && { skillLabel }),

    // Flag: stats came from the Excel file (no scraping needed)
    statsSource: hasExcelStats ? 'excel' : 'none',
    statsScrapedAt: hasExcelStats ? new Date().toISOString() : undefined,

    isLegend:   false,
    isOwner:    false,
    isRetained: false,
    createdAt:  new Date().toISOString(),
  };
}

// ─── Map Team Owners Excel row → Team object ──────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRowToTeam(row: Record<string, any>): Omit<Team, 'id'> {
  const owners = [row['Owner 1'], row['Owner 2'], row['Owner 3']]
    .filter(Boolean)
    .map((o: string) => String(o).trim());

  const retainedPlayers = [row['Retained 1'], row['Retained 2'], row['Retained 3']]
    .filter(Boolean)
    .map((r: string) => String(r).trim());

  return {
    name:           String(row['Team Name'] || '').trim(),
    group:          String(row['Group'] || '') as Team['group'],
    owners,
    retainedPlayers,
    totalPurse:     200000,   // Default ₹2,00,000 — configurable in admin
    purseRemaining: 200000,
    squadCount:     0,
    categoryACount: 0,
    age3035Count:   0,
    createdAt:      new Date().toISOString(),
  };
}
