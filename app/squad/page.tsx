'use client';
import { useState, useEffect, useMemo } from 'react';
import { Player } from '@/types';
import { formatCurrency } from '@/lib/rules';
import { deriveTier, deriveAgeBracket } from '@/lib/import';
import PlayerModal from '@/components/PlayerModal';
import {
  ArrowLeft, ShieldCheck, ShieldPlus, Trash2, Trophy,
  Users, BarChart3, Wallet, Wind, Heart, Loader2,
  Search, Filter
} from 'lucide-react';

const normalizePlayer = (p: Player): Player => {
  const raw = p.rawCategory || '';
  const record = p as unknown as Record<string, unknown>;
  const tier = p.tier || deriveTier(raw, record);
  const ageBracket = p.ageBracket || deriveAgeBracket(raw, p.age, record);
  return { ...p, tier, ageBracket };
};

const roleColors: Record<string, string> = {
  Batsman: 'text-amber-400 bg-amber-400/10',
  'Batting Allrounder': 'text-orange-400 bg-orange-400/10',
  'Spin Bowling Allrounder': 'text-violet-400 bg-violet-400/10',
  'Fast Bowling Allrounder': 'text-rose-400 bg-rose-400/10',
  'Leg Spin Bowler': 'text-violet-300 bg-violet-300/10',
  'Off Spin Bowler': 'text-purple-400 bg-purple-400/10',
  'Wicket Keeper Batsman': 'text-cyan-400 bg-cyan-400/10',
  'Medium Pacer': 'text-red-400 bg-red-400/10',
  'Fast Bowler': 'text-red-500 bg-red-500/10',
};

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
  return raw.length > 18 ? raw.substring(0, 16) + '…' : raw;
}

export default function SquadPage() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [squadIds, setSquadIds] = useState<Set<string>>(new Set());
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [pRes, sRes, wRes] = await Promise.all([
          fetch('/api/players'),
          fetch('/api/squad'),
          fetch('/api/wishlist'),
        ]);
        const [pData, sData, wData] = await Promise.all([pRes.json(), sRes.json(), wRes.json()]);
        if (pData.success) setAllPlayers(pData.players.map(normalizePlayer));
        if (sData.success) setSquadIds(new Set(sData.playerIds));
        if (wData.success) setWishlistIds(new Set(wData.playerIds));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const squadPlayers = useMemo(
    () => allPlayers.filter((p) => squadIds.has(p.id)),
    [allPlayers, squadIds]
  );

  const filtered = useMemo(() => {
    if (!search) return squadPlayers;
    return squadPlayers.filter((p) => p.fullName.toLowerCase().includes(search.toLowerCase()));
  }, [squadPlayers, search]);

  const stats = useMemo(() => {
    const catA = squadPlayers.filter((p) => p.tier === 'A').length;
    const catB = squadPlayers.filter((p) => p.tier === 'B').length;
    const u35 = squadPlayers.filter((p) => p.ageBracket === 'under_35').length;
    const above35 = squadPlayers.filter((p) => p.ageBracket === 'above_35').length;
    const totalBase = squadPlayers.reduce((sum, p) => sum + (p.soldPrice ?? p.basePrice), 0);
    return { catA, catB, u35, above35, totalBase, total: squadPlayers.length };
  }, [squadPlayers]);

  const removeFromSquad = async (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    setRemoving(playerId);
    try {
      const res = await fetch('/api/squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, action: 'remove' }),
      });
      const data = await res.json();
      if (data.success) setSquadIds(new Set(data.playerIds));
    } catch (e) {
      console.error(e);
    } finally {
      setRemoving(null);
    }
  };

  const toggleWishlist = async (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (data.success) setWishlistIds(new Set(data.playerIds));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[oklch(0.12_0.01_250)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[oklch(0.12_0.01_250)]/95 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="/directory"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Directory
            </a>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white leading-none">My Squad</h1>
                <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Your auction picks</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search squad…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/6 border border-white/10 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-all"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { icon: Users, label: 'Total', value: stats.total, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { icon: Trophy, label: 'Cat A', value: stats.catA, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { icon: Filter, label: 'Cat B', value: stats.catB, color: 'text-zinc-300', bg: 'bg-zinc-500/10' },
            { icon: BarChart3, label: 'U35', value: stats.u35, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { icon: BarChart3, label: '35+', value: stats.above35, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            { icon: Wallet, label: 'Est. Cost', value: formatCurrency(stats.totalBase), color: 'text-rose-400', bg: 'bg-rose-500/10' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={`${bg} border border-white/6 rounded-2xl p-3 flex items-center gap-2`}>
              <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
              <div>
                <p className="text-[10px] text-zinc-500">{label}</p>
                <p className="text-base font-bold text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Squad rules reminder */}
        <div className="bg-white/3 border border-white/6 rounded-2xl px-4 py-3 mb-5 flex flex-wrap gap-4 text-xs text-zinc-500">
          <span>📋 Max squad: <span className="text-white">20 players</span></span>
          <span>🏆 Cat A slots: <span className="text-amber-400">unlimited</span></span>
          <span>🎂 Max 30–35 age: <span className="text-white">3 players</span></span>
          <span>💰 Purse: <span className="text-white">₹2,00,000</span></span>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <ShieldPlus className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium text-zinc-400">
              {squadPlayers.length === 0 ? 'Your squad is empty' : 'No players match your search'}
            </p>
            <p className="text-sm mt-2">
              {squadPlayers.length === 0
                ? 'Go to the Directory and click the 🛡 shield icon on any player to add them to your squad'
                : 'Clear the search to see all squad players'}
            </p>
            {squadPlayers.length === 0 && (
              <a
                href="/directory"
                className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Go to Directory
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((player, idx) => {
              const roleStyle = roleColors[player.playingAs] ?? 'text-zinc-300 bg-zinc-300/10';
              const bowling = getBowlingLabel(player.bowlingStyles);
              return (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                  className="w-full text-left group flex items-center gap-4 p-4 rounded-2xl border border-white/6 bg-white/3 hover:bg-white/6 hover:border-white/12 transition-all"
                >
                  {/* Number */}
                  <div className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-xs font-bold text-zinc-500 flex-shrink-0">
                    {idx + 1}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white group-hover:text-emerald-200 transition-colors truncate">
                          {player.fullName}
                        </span>
                        {player.tier === 'A' && (
                          <span className="flex-shrink-0 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Trophy className="w-2 h-2" /> A
                          </span>
                        )}
                        {wishlistIds.has(player.id) && (
                          <span className="flex-shrink-0 text-rose-400" title="In wishlist">
                            <Heart className="w-3 h-3 fill-current" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {player.age.toFixed(1)} yrs • {player.ageBracket === 'under_35' ? 'U35' : '35+'} • {player.battingStyle || '—'}
                        {bowling && <span className="ml-2 opacity-60">🎳 {bowling}</span>}
                      </p>
                    </div>

                    {/* Role */}
                    <span className={`self-start sm:self-auto text-[10px] font-medium px-2 py-1 rounded-lg ${roleStyle}`}>
                      {player.playingAs}
                    </span>

                    {/* Stats */}
                    <div className="flex gap-3 text-[11px]">
                      {player.battingAvg && (
                        <div className="text-center">
                          <p className="text-zinc-500">Avg</p>
                          <p className="text-white font-semibold">{player.battingAvg.toFixed(1)}</p>
                        </div>
                      )}
                      {player.strikeRate && (
                        <div className="text-center">
                          <p className="text-zinc-500">SR</p>
                          <p className="text-white font-semibold">{player.strikeRate.toFixed(1)}</p>
                        </div>
                      )}
                      {player.careerWickets !== undefined && (
                        <div className="text-center">
                          <p className="text-zinc-500">Wkts</p>
                          <p className="text-white font-semibold">{player.careerWickets}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price + Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold text-blue-300">
                      {player.status === 'sold' ? formatCurrency(player.soldPrice!) : formatCurrency(player.basePrice)}
                    </span>
                    <button
                      onClick={(e) => toggleWishlist(e, player.id)}
                      title={wishlistIds.has(player.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                      className={`p-1.5 rounded-lg transition-all ${wishlistIds.has(player.id) ? 'text-rose-400 bg-rose-500/15' : 'text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10'}`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${wishlistIds.has(player.id) ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => removeFromSquad(e, player.id)}
                      disabled={removing === player.id}
                      title="Remove from squad"
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40"
                    >
                      {removing === player.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Add more hint */}
        {!loading && squadPlayers.length > 0 && squadPlayers.length < 20 && (
          <div className="mt-6 text-center">
            <a
              href="/directory"
              className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
            >
              <ShieldPlus className="w-3.5 h-3.5" />
              Add more players from Directory ({20 - squadPlayers.length} slots remaining)
            </a>
          </div>
        )}
      </main>

      {selectedPlayer && (
        <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}
