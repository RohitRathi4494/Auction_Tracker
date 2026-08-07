// Shared TypeScript types for the SCCL Auction Dashboard

export type Tier = 'A' | 'B';
export type AgeBracket = 'under_35' | 'above_35';
export type PlayerStatus = 'available' | 'in_auction' | 'sold' | 'unsold';
export type AuctionPhase = 'idle' | 'bidding' | 'tiebreaker' | 'sold' | 'unsold';
export type TeamGroup = 'Elite' | 'Challengers' | 'Fighters';

export type PlayingRole =
  | 'Batsman'
  | 'Leg Spin Bowler'
  | 'Wicket Keeper Batsman'
  | 'Spin Bowling Allrounder'
  | 'Fast Bowling Allrounder'
  | 'Batting Allrounder'
  | 'Medium Pacer'
  | 'Fast Bowler'
  | 'Off Spin Bowler';

export interface Player {
  id: string;
  fullName: string;
  phone: string;
  age: number;
  playingAs: string;
  battingStyle: string;
  bowlingStyles: string[];
  cricHeroesUrl: string;
  rawCategory: string;   // U35A | 35+A | 35+B | U35B
  tier: Tier;
  ageBracket: AgeBracket;
  basePrice: number;
  status: PlayerStatus;
  soldToTeamId?: string;
  soldToTeamName?: string;
  soldPrice?: number;
  // Core stats (used for category classification)
  battingAvg?: number;
  strikeRate?: number;
  careerWickets?: number;
  economy?: number;
  statsSource?: 'excel' | 'scraper' | 'manual' | 'none';
  statsScrapedAt?: string;
  statsOverride?: Partial<PlayerStats>;

  // Extended batting stats (from Excel)
  battingMatches?: number;
  battingInnings?: number;
  notOut?: number;
  battingRuns?: number;
  highestScore?: number;
  thirties?: number;
  fifties?: number;
  hundreds?: number;
  fours?: number;
  sixes?: number;
  ducks?: number;

  // Extended bowling stats (from Excel)
  bowlingMatches?: number;
  bowlingInnings?: number;
  overs?: number;
  maidens?: number;
  bowlingRuns?: number;
  bestBowling?: string;
  threeWickets?: number;
  fiveWickets?: number;
  bowlingSR?: number;
  bowlingAvg?: number;
  wides?: number;
  noBalls?: number;
  dotBalls?: number;

  // Fielding / general
  totalMatches?: number;
  caughtBehind?: number;
  runOuts?: number;
  stumpings?: number;
  assistedRunOuts?: number;
  byeRuns?: number;
  catches?: number;
  skillLabel?: string;

  // Flags
  isLegend: boolean;
  isOwner: boolean;
  isRetained: boolean;
  createdAt?: string;
}

// Lightweight snapshot of a player stored in the wishlist, so a wishlisted
// player survives even if they are later removed/renamed in the directory.
export interface WishlistSnapshot {
  id: string;
  fullName: string;
  phone?: string;
  playingAs?: string;
  tier?: Tier;
  ageBracket?: AgeBracket;
  age?: number;
  basePrice?: number;
  rawCategory?: string;
  status?: PlayerStatus;
  cricHeroesUrl?: string;
}

export interface SquadCustomPlayer {
  id: string;      // e.g. custom-<uuid>
  name: string;
  price: number;
  category?: Tier;   // 'A' | 'B' — optional, for off-directory players
  age?: number;      // optional
}

// Per-target tracking info stored alongside a wishlisted player.
// The wishlist doubles as the "Targets" board the owner bids from.
export type TargetStatus =
  | 'targeting'   // still chasing this player
  | 'bought'      // won by me
  | 'lost';       // sold to another team

export interface TargetMeta {
  priority?: number;      // numeric rank within category (lower = higher priority)
  status?: TargetStatus;  // manually tracked outcome
}

export interface SquadData {
  playerIds: string[];
  purse: number;
  prices: Record<string, number>;   // playerId -> price paid
  customPlayers: SquadCustomPlayer[];
}

export interface PlayerStats {
  battingAvg: number;
  strikeRate: number;
  careerWickets: number;
  economy: number;
}

export interface Team {
  id: string;
  name: string;
  group: TeamGroup;
  owners: string[];
  retainedPlayers: string[];
  totalPurse: number;
  purseRemaining: number;
  squadCount: number;
  categoryACount: number;
  age3035Count: number;
  createdAt?: string;
}

export interface User {
  id: string; // The doc ID in Firestore (username)
  username: string;
  passwordHash: string;
  role: 'admin' | 'owner';
  teamId?: string | null; // For owners, which team they manage
  createdAt: string;
}

export interface SessionPayload {
  username: string;
  role: 'admin' | 'owner';
  teamId?: string | null;
  exp: number; // Expiration timestamp
}


export interface AuctionState {
  currentPlayerId: string | null;
  currentBid: number;
  currentBidTeamId: string | null;
  phase: AuctionPhase;
  tiebreakerTeams: string[];
  updatedAt?: string;
}

export interface AuctionLogEntry {
  id: string;
  playerId: string;
  teamId: string;
  playerName: string;
  teamName: string;
  bidAmount: number;
  action: 'sold' | 'unsold' | 'returned' | 'undo';
  timestamp: string;
}

export interface RuleViolation {
  type: 'error' | 'warning';
  message: string;
  code: string;
}
