import { Player, Team, RuleViolation } from '@/types';

// ─── Bid increment rules ──────────────────────────────────────────────────────
export function getBidIncrement(player: Player): number {
  if (player.tier === 'A' && !player.isLegend) return 5000;
  return 2000; // Category B and Legends
}

// ─── Validate a bid before placing ───────────────────────────────────────────
export function validateBid(
  player: Player,
  team: Team,
  bidAmount: number,
  currentBid: number,
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const increment = getBidIncrement(player);

  // 1. Min bid must be at or above base price
  if (bidAmount < player.basePrice) {
    violations.push({
      type: 'error',
      code: 'BELOW_BASE_PRICE',
      message: `Bid must be at least ₹${player.basePrice.toLocaleString('en-IN')} (base price)`,
    });
  }

  // 2. Bid must be a valid increment above current bid
  if (currentBid > 0 && bidAmount !== currentBid + increment) {
    violations.push({
      type: 'error',
      code: 'INVALID_INCREMENT',
      message: `Bid must increase by ₹${increment.toLocaleString('en-IN')} (next valid: ₹${(currentBid + increment).toLocaleString('en-IN')})`,
    });
  }

  // 3. Max bid ₹50,000 (tie-breaker is separate flow)
  if (bidAmount > 50000) {
    violations.push({
      type: 'error',
      code: 'EXCEEDS_MAX_BID',
      message: 'Maximum bid is ₹50,000. Use tie-breaker mode to go above.',
    });
  }

  // 4. Purse check
  if (bidAmount > team.purseRemaining) {
    violations.push({
      type: 'error',
      code: 'INSUFFICIENT_PURSE',
      message: `Team has only ₹${team.purseRemaining.toLocaleString('en-IN')} remaining in purse`,
    });
  }

  // 5. Squad size — max 20
  if (team.squadCount >= 20) {
    violations.push({
      type: 'error',
      code: 'SQUAD_FULL',
      message: 'Squad is full (20 players maximum)',
    });
  }

  // 6. Age 30–35 cap — max 3
  const playerAge = player.age;
  if (playerAge >= 30 && playerAge < 35 && team.age3035Count >= 3) {
    violations.push({
      type: 'error',
      code: 'AGE_CAP_EXCEEDED',
      message: 'Team already has 3 players aged 30–35 (maximum allowed)',
    });
  }

  // 7. Category A cap — warn at 6 (not a hard block)
  if (player.tier === 'A' && team.categoryACount >= 6) {
    violations.push({
      type: 'warning',
      code: 'CAT_A_CAP_WARNING',
      message: 'Team already has 6 Category A players. Playing 13 will need careful selection per match.',
    });
  }

  return violations;
}

// ─── Validate tie-breaker sealed tender ──────────────────────────────────────
export function validateTieBreakerBid(amount: number): RuleViolation[] {
  const violations: RuleViolation[] = [];
  if (amount < 50000) {
    violations.push({ type: 'error', code: 'TIEBREAKER_TOO_LOW', message: 'Tie-breaker bid must be at least ₹50,000' });
  }
  if (amount > 100000) {
    violations.push({ type: 'error', code: 'TIEBREAKER_TOO_HIGH', message: 'Tie-breaker bid cannot exceed ₹1,00,000' });
  }
  return violations;
}

// ─── Check shortfall penalty (< 16 players) ───────────────────────────────────
export function shouldApplyShortfallPenalty(team: Team): boolean {
  return team.squadCount < 16;
}

// ─── Calculate shortfall refund (70% of costliest pick) ───────────────────────
export function calculateShortfallRefund(soldPrice: number): number {
  return Math.round(soldPrice * 0.7);
}

// ─── Check if player is in 30–35 age bracket ─────────────────────────────────
export function isAge3035(age: number): boolean {
  return age >= 30 && age < 35;
}

// ─── Format currency ─────────────────────────────────────────────────────────
export function formatCurrency(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount}`;
}
