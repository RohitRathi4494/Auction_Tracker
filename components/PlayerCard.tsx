'use client';
import { Player } from '@/types';
import { formatCurrency } from '@/lib/rules';
import { Trophy, Star, User, Zap, Heart, Wind, RefreshCw } from 'lucide-react';

interface Props {
  player: Player;
  onClick: () => void;
  wishlisted?: boolean;
  onWishlist?: (e: React.MouseEvent) => void;
}

const roleColors: Record<string, string> = {
  Batsman: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  'Batting Allrounder': 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  'Spin Bowling Allrounder': 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  'Fast Bowling Allrounder': 'text-rose-400 bg-rose-400/10 border-rose-400/30',
  'Leg Spin Bowler': 'text-violet-300 bg-violet-300/10 border-violet-300/30',
  'Off Spin Bowler': 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  'Wicket Keeper Batsman': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  'Medium Pacer': 'text-red-400 bg-red-400/10 border-red-400/30',
  'Fast Bowler': 'text-red-500 bg-red-500/10 border-red-500/30',
};

const statusStyles: Record<string, string> = {
  available: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  sold: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  unsold: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
  in_auction: 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse',
};

/**
 * Derives a short, human-readable bowling style label from the bowlingStyles array.
 * e.g. ["Right Arm Fast"] → "RA Fast"
 *      ["Left Arm Spin"]  → "LA Spin"
 */
function getBowlingLabel(styles: string[] | undefined): string | null {
  if (!styles || styles.length === 0) return null;
  const raw = styles[0].trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const hand = lower.includes('left') ? 'LA' : lower.includes('right') ? 'RA' : '';

  let type = '';
  if (lower.includes('fast') || lower.includes('pace')) type = 'Fast';
  else if (lower.includes('medium')) type = 'Medium';
  else if (lower.includes('spin') || lower.includes('off') || lower.includes('leg')) {
    if (lower.includes('leg')) type = 'Leg Spin';
    else if (lower.includes('off')) type = 'Off Spin';
    else type = 'Spin';
  }

  if (hand && type) return `${hand} ${type}`;
  if (hand) return `${hand} Arm`;
  return raw.length > 20 ? raw.substring(0, 18) + '…' : raw;
}

export default function PlayerCard({ player, onClick, wishlisted = false, onWishlist }: Props) {
  const roleStyle = roleColors[player.playingAs] ?? 'text-zinc-300 bg-zinc-300/10 border-zinc-300/30';
  const statusStyle = statusStyles[player.status] ?? statusStyles.available;
  const bowlingLabel = getBowlingLabel(player.bowlingStyles);

  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/16 transition-all duration-200 overflow-hidden cursor-pointer"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-blue-500/5 via-transparent to-violet-500/5 rounded-2xl pointer-events-none" />

      {/* Category A badge glow */}
      {player.tier === 'A' && (
        <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl pointer-events-none" />
      )}

      <div className="p-4 relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm leading-tight truncate group-hover:text-blue-200 transition-colors">
              {player.fullName}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">{player.age.toFixed(1)} yrs • {player.battingStyle || '—'}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Wishlist button */}
            {onWishlist && (
              <button
                onClick={onWishlist}
                title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                className={`p-1 rounded-lg transition-all ${wishlisted ? 'text-rose-400 bg-rose-500/20' : 'text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10'}`}
              >
                <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />
              </button>
            )}
            {/* Category A badge */}
            {player.tier === 'A' && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <Trophy className="w-2.5 h-2.5" />A
              </span>
            )}
          </div>
        </div>

        {/* Role badge */}
        <div className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-lg border mb-2 ${roleStyle}`}>
          <Zap className="w-2.5 h-2.5" />
          {player.playingAs}
        </div>

        {/* Bowling hand label */}
        {bowlingLabel && (
          <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-2">
            <Wind className="w-2.5 h-2.5 text-zinc-500" />
            <span>{bowlingLabel}</span>
          </div>
        )}

        {/* Stats row */}
        {(player.battingAvg || player.careerWickets) && (
          <div className="flex gap-3 mb-2 text-[11px]">
            {player.battingAvg && (
              <div className="flex flex-col">
                <span className="text-zinc-500">Avg</span>
                <span className="text-white font-semibold">{player.battingAvg.toFixed(1)}</span>
              </div>
            )}
            {player.strikeRate && (
              <div className="flex flex-col">
                <span className="text-zinc-500">SR</span>
                <span className="text-white font-semibold">{player.strikeRate.toFixed(1)}</span>
              </div>
            )}
            {player.careerWickets !== undefined && (
              <div className="flex flex-col">
                <span className="text-zinc-500">Wkts</span>
                <span className="text-white font-semibold">{player.careerWickets}</span>
              </div>
            )}
            {player.economy && (
              <div className="flex flex-col">
                <span className="text-zinc-500">Econ</span>
                <span className="text-white font-semibold">{player.economy.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-300">
            {player.status === 'sold' ? formatCurrency(player.soldPrice!) : formatCurrency(player.basePrice)}
          </span>
          <div className="flex items-center gap-1.5">
            {player.isLegend && <span title="Legend"><Star className="w-3 h-3 text-amber-400" /></span>}
            {player.isOwner && <span title="Owner"><RefreshCw className="w-3 h-3 text-blue-400" /></span>}
            {player.isRetained && <span title="Retained"><User className="w-3 h-3 text-emerald-400" /></span>}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusStyle}`}>
              {player.status === 'sold' && player.soldToTeamName
                ? player.soldToTeamName.split(' ')[0]
                : player.status}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
