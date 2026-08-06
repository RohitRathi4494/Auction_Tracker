'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Player, SquadCustomPlayer } from '@/types';
import { formatCurrency } from '@/lib/rules';
import { deriveTier, deriveAgeBracket } from '@/lib/import';
import PlayerModal from '@/components/PlayerModal';
import {
  ArrowLeft, ShieldCheck, ShieldPlus, Trash2, Trophy,
  Users, BarChart3, Wallet, Heart, Loader2,
  Search, Filter, Plus, Pencil, Check, X, UserPlus, IndianRupee,
} from 'lucide-react';

const normalizePlayer = (p: Player): Player => {
  const raw = p.rawCategory || '';
  const record = p as unknown as Record<string, unknown>;
  const tier = p.tier || deriveTier(raw, record);
  const ageBracket = p.ageBracket || deriveAgeBracket(raw, p.age, record);
  return { ...p, tier, ageBracket };
};

const rupee = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

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

  // Owner purse + pricing state
  const [isOwner, setIsOwner] = useState(false);
  const [purse, setPurse] = useState(200000);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [customPlayers, setCustomPlayers] = useState<SquadCustomPlayer[]>([]);

  // Inline editing state
  const [editingPurse, setEditingPurse] = useState(false);
  const [purseInput, setPurseInput] = useState('');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const applySquadMeta = useCallback((meta: {
    purse?: number;
    prices?: Record<string, number>;
    customPlayers?: SquadCustomPlayer[];
  } | undefined) => {
    if (!meta) return;
    if (typeof meta.purse === 'number') setPurse(meta.purse);
    if (meta.prices) setPrices(meta.prices);
    if (Array.isArray(meta.customPlayers)) setCustomPlayers(meta.customPlayers);
  }, []);

  useEffect(() => {
    // 1. Instant hydration from client session cache if available
    try {
      const cached = sessionStorage.getItem('sccl_init_data');
      if (cached) {
        const data = JSON.parse(cached);
        if (data.players?.length) setAllPlayers(data.players.map(normalizePlayer));
        if (data.squad) setSquadIds(new Set(data.squad));
        if (data.wishlist) setWishlistIds(new Set(data.wishlist));
        if (data.user?.teamId) setIsOwner(true);
        applySquadMeta(data.squadMeta);
        setLoading(false);
      }
    } catch { /* ignore */ }

    // 2. Fetch fresh data in single /api/init call
    const init = async () => {
      try {
        const res = await fetch('/api/init');
        const data = await res.json();
        if (data.success) {
          if (data.players?.length) setAllPlayers(data.players.map(normalizePlayer));
          if (data.squad) setSquadIds(new Set(data.squad));
          if (data.wishlist) setWishlistIds(new Set(data.wishlist));
          setIsOwner(Boolean(data.user?.teamId));
          applySquadMeta(data.squadMeta);
          sessionStorage.setItem('sccl_init_data', JSON.stringify(data));
        }
      } catch (e) {
        console.error('Squad init error:', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [applySquadMeta]);

  const squadPlayers = useMemo(
    () => allPlayers.filter((p) => squadIds.has(p.id)),
    [allPlayers, squadIds]
  );

  // Price actually paid for a directory player (explicit override, else sold/base)
  const priceOf = useCallback(
    (p: Player) => prices[p.id] ?? p.soldPrice ?? p.basePrice,
    [prices]
  );

  const filtered = useMemo(() => {
    if (!search) return squadPlayers;
    return squadPlayers.filter((p) => p.fullName.toLowerCase().includes(search.toLowerCase()));
  }, [squadPlayers, search]);

  const filteredCustom = useMemo(() => {
    if (!search) return customPlayers;
    return customPlayers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [customPlayers, search]);

  const stats = useMemo(() => {
    const catA = squadPlayers.filter((p) => p.tier === 'A').length;
    const catB = squadPlayers.filter((p) => p.tier === 'B').length;
    const u35 = squadPlayers.filter((p) => p.ageBracket === 'under_35').length;
    const above35 = squadPlayers.filter((p) => p.ageBracket === 'above_35').length;
    const directorySpent = squadPlayers.reduce((sum, p) => sum + priceOf(p), 0);
    const customSpent = customPlayers.reduce((sum, c) => sum + c.price, 0);
    const spent = directorySpent + customSpent;
    return {
      catA, catB, u35, above35, spent,
      total: squadPlayers.length + customPlayers.length,
      remaining: purse - spent,
    };
  }, [squadPlayers, customPlayers, priceOf, purse]);

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const postSquad = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/squad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');
    // Server is source of truth for purse/prices/custom
    if (data.playerIds) setSquadIds(new Set(data.playerIds));
    if (typeof data.purse === 'number') setPurse(data.purse);
    if (data.prices) setPrices(data.prices);
    if (Array.isArray(data.customPlayers)) setCustomPlayers(data.customPlayers);
    return data;
  }, []);

  const removeFromSquad = async (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    setRemoving(playerId);
    try {
      await postSquad({ playerId, action: 'remove' });
    } catch (err) {
      console.error(err);
    } finally {
      setRemoving(null);
    }
  };

  const removeCustom = async (e: React.MouseEvent, customId: string) => {
    e.stopPropagation();
    setRemoving(customId);
    try {
      await postSquad({ action: 'remove_custom', customId });
    } catch (err) {
      console.error(err);
    } finally {
      setRemoving(null);
    }
  };

  const toggleWishlist = async (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    try {
      const p = allPlayers.find((pl) => pl.id === playerId);
      const snapshot = p
        ? {
            id: p.id, fullName: p.fullName, phone: p.phone, playingAs: p.playingAs,
            tier: p.tier, ageBracket: p.ageBracket, age: p.age, basePrice: p.basePrice,
            rawCategory: p.rawCategory, status: p.status, cricHeroesUrl: p.cricHeroesUrl,
          }
        : undefined;
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, snapshot }),
      });
      const data = await res.json();
      if (data.success) setWishlistIds(new Set(data.playerIds));
    } catch (e) {
      console.error(e);
    }
  };

  const savePurse = async () => {
    const val = Number(purseInput.replace(/[,\s]/g, ''));
    if (!Number.isFinite(val) || val < 0) { setEditingPurse(false); return; }
    setSaving(true);
    try {
      await postSquad({ action: 'set_purse', purse: val });
      setEditingPurse(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const savePrice = async (target: Player | SquadCustomPlayer, isCustom: boolean) => {
    const val = Number(priceInput.replace(/[,\s]/g, ''));
    if (!Number.isFinite(val) || val < 0) { setEditingPriceId(null); return; }
    setSaving(true);
    try {
      if (isCustom) {
        await postSquad({ action: 'update_custom', customId: target.id, price: val });
      } else {
        await postSquad({ action: 'set_price', playerId: target.id, price: val });
      }
      setEditingPriceId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const startEditPrice = (e: React.MouseEvent, id: string, current: number) => {
    e.stopPropagation();
    setEditingPriceId(id);
    setPriceInput(String(current));
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

          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 px-3 py-2 rounded-xl transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Player
              </button>
            )}
            {/* Search */}
            <div className="relative w-40 sm:w-56">
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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Purse card (owners only) */}
        {isOwner && (
          <div className="mb-5 rounded-2xl border border-white/8 bg-gradient-to-br from-white/6 to-white/3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Total Purse</p>
                  {editingPurse ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="relative">
                        <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                        <input
                          autoFocus
                          type="text"
                          inputMode="numeric"
                          value={purseInput}
                          onChange={(e) => setPurseInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') savePurse(); if (e.key === 'Escape') setEditingPurse(false); }}
                          className="w-32 pl-6 pr-2 py-1 rounded-lg bg-black/30 border border-emerald-500/40 text-sm text-white focus:outline-none"
                        />
                      </div>
                      <button onClick={savePurse} disabled={saving} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditingPurse(false)} className="p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setPurseInput(String(purse)); setEditingPurse(true); }}
                      className="group flex items-center gap-1.5 mt-0.5"
                    >
                      <span className="text-lg font-bold text-white">{rupee(purse)}</span>
                      <Pencil className="w-3 h-3 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Spent</p>
                  <p className="text-lg font-bold text-rose-300">{rupee(stats.spent)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Remaining</p>
                  <p className={`text-lg font-bold ${stats.remaining < 0 ? 'text-red-400' : 'text-emerald-300'}`}>
                    {rupee(stats.remaining)}
                  </p>
                </div>
              </div>
            </div>

            {/* Purse bar */}
            <div className="mt-3 h-2 rounded-full bg-white/8 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${stats.remaining < 0 ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
                style={{ width: `${purse > 0 ? Math.min(100, Math.max(0, (stats.spent / purse) * 100)) : 0}%` }}
              />
            </div>
            {stats.remaining < 0 && (
              <p className="mt-2 text-[11px] text-red-400">⚠ Over budget by {rupee(-stats.remaining)}</p>
            )}
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { icon: Users, label: 'Total', value: stats.total, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { icon: Trophy, label: 'Cat A', value: stats.catA, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { icon: Filter, label: 'Cat B', value: stats.catB, color: 'text-zinc-300', bg: 'bg-zinc-500/10' },
            { icon: BarChart3, label: 'U35', value: stats.u35, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { icon: BarChart3, label: '35+', value: stats.above35, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            { icon: Wallet, label: isOwner ? 'Spent' : 'Est. Cost', value: formatCurrency(stats.spent), color: 'text-rose-400', bg: 'bg-rose-500/10' },
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

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : filtered.length === 0 && filteredCustom.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <ShieldPlus className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium text-zinc-400">
              {squadPlayers.length === 0 && customPlayers.length === 0 ? 'Your squad is empty' : 'No players match your search'}
            </p>
            <p className="text-sm mt-2">
              {squadPlayers.length === 0 && customPlayers.length === 0
                ? isOwner
                  ? 'Click “Add Player” to add players from the directory or add your own, and set the price paid'
                  : 'Go to the Directory and click the 🛡 shield icon on any player to add them to your squad'
                : 'Clear the search to see all squad players'}
            </p>
            {squadPlayers.length === 0 && customPlayers.length === 0 && (
              isOwner ? (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Player
                </button>
              ) : (
                <a
                  href="/directory"
                  className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Go to Directory
                </a>
              )
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Directory players */}
            {filtered.map((player, idx) => {
              const roleStyle = roleColors[player.playingAs] ?? 'text-zinc-300 bg-zinc-300/10';
              const bowling = getBowlingLabel(player.bowlingStyles);
              const isEditing = editingPriceId === player.id;
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
                    {isOwner && isEditing ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <div className="relative">
                          <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                          <input
                            autoFocus
                            type="text"
                            inputMode="numeric"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') savePrice(player, false); if (e.key === 'Escape') setEditingPriceId(null); }}
                            className="w-24 pl-6 pr-2 py-1 rounded-lg bg-black/40 border border-emerald-500/40 text-xs text-white focus:outline-none"
                          />
                        </div>
                        <button onClick={() => savePrice(player, false)} disabled={saving} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30">
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setEditingPriceId(null)} className="p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : isOwner ? (
                      <button
                        onClick={(e) => startEditPrice(e, player.id, priceOf(player))}
                        title="Set price paid"
                        className="group/price flex items-center gap-1 text-xs font-bold text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded-lg transition-all"
                      >
                        {rupee(priceOf(player))}
                        <Pencil className="w-2.5 h-2.5 opacity-50 group-hover/price:opacity-100" />
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-blue-300">
                        {player.status === 'sold' ? formatCurrency(player.soldPrice!) : formatCurrency(player.basePrice)}
                      </span>
                    )}
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

            {/* Custom (off-directory) players */}
            {filteredCustom.map((cp) => {
              const isEditing = editingPriceId === cp.id;
              return (
                <div
                  key={cp.id}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-dashed border-white/12 bg-white/[0.02]"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center flex-shrink-0">
                    <UserPlus className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">{cp.name}</span>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 border border-white/10">
                        Manual
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">Not in directory</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <div className="relative">
                          <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                          <input
                            autoFocus
                            type="text"
                            inputMode="numeric"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') savePrice(cp, true); if (e.key === 'Escape') setEditingPriceId(null); }}
                            className="w-24 pl-6 pr-2 py-1 rounded-lg bg-black/40 border border-emerald-500/40 text-xs text-white focus:outline-none"
                          />
                        </div>
                        <button onClick={() => savePrice(cp, true)} disabled={saving} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30">
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setEditingPriceId(null)} className="p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => startEditPrice(e, cp.id, cp.price)}
                        title="Edit price"
                        className="group/price flex items-center gap-1 text-xs font-bold text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded-lg transition-all"
                      >
                        {rupee(cp.price)}
                        <Pencil className="w-2.5 h-2.5 opacity-50 group-hover/price:opacity-100" />
                      </button>
                    )}
                    <button
                      onClick={(e) => removeCustom(e, cp.id)}
                      disabled={removing === cp.id}
                      title="Remove player"
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40"
                    >
                      {removing === cp.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add more hint */}
        {!loading && (squadPlayers.length > 0 || customPlayers.length > 0) && (
          <div className="mt-6 text-center">
            {isOwner ? (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                <ShieldPlus className="w-3.5 h-3.5" /> Add another player
              </button>
            ) : squadPlayers.length < 20 && (
              <a
                href="/directory"
                className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                <ShieldPlus className="w-3.5 h-3.5" />
                Add more players from Directory ({20 - squadPlayers.length} slots remaining)
              </a>
            )}
          </div>
        )}
      </main>

      {selectedPlayer && (
        <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}

      {showAddModal && (
        <AddPlayerModal
          allPlayers={allPlayers}
          squadIds={squadIds}
          onClose={() => setShowAddModal(false)}
          onAddDirectory={(playerId, price) => postSquad({ action: 'set_price', playerId, price })}
          onAddCustom={(name, price) => postSquad({ action: 'add_custom', name, price })}
        />
      )}
    </div>
  );
}

// ─── Add Player Modal ──────────────────────────────────────────────────────────
function AddPlayerModal({
  allPlayers, squadIds, onClose, onAddDirectory, onAddCustom,
}: {
  allPlayers: Player[];
  squadIds: Set<string>;
  onClose: () => void;
  onAddDirectory: (playerId: string, price: number) => Promise<unknown>;
  onAddCustom: (name: string, price: number) => Promise<unknown>;
}) {
  const [tab, setTab] = useState<'directory' | 'custom'>('directory');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Player | null>(null);
  const [price, setPrice] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const available = useMemo(() => {
    const q = search.toLowerCase();
    return allPlayers
      .filter((p) => !squadIds.has(p.id))
      .filter((p) => !q || p.fullName.toLowerCase().includes(q))
      .slice(0, 60);
  }, [allPlayers, squadIds, search]);

  const submit = async () => {
    setError('');
    const val = Number(price.replace(/[,\s]/g, ''));
    if (!Number.isFinite(val) || val < 0) { setError('Enter a valid price'); return; }
    setBusy(true);
    try {
      if (tab === 'directory') {
        if (!selected) { setError('Pick a player'); setBusy(false); return; }
        await onAddDirectory(selected.id, val);
      } else {
        if (!name.trim()) { setError('Enter a player name'); setBusy(false); return; }
        await onAddCustom(name.trim(), val);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[oklch(0.15_0.01_250)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-400" /> Add Player to Squad
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4">
          {(['directory', 'custom'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all ${
                tab === t ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {t === 'directory' ? 'From Directory' : 'Custom Player'}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-3">
          {tab === 'directory' ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search players…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/6 border border-white/10 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40"
                />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {available.length === 0 ? (
                  <p className="text-center text-xs text-zinc-600 py-6">No players found</p>
                ) : available.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelected(p); if (!price) setPrice(String(p.soldPrice ?? p.basePrice)); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                      selected?.id === p.id ? 'bg-emerald-600/20 border border-emerald-500/40' : 'bg-white/4 border border-white/6 hover:bg-white/8'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{p.fullName}</p>
                      <p className="text-[10px] text-zinc-500">
                        {p.age.toFixed(1)}y • {p.tier === 'A' ? 'Cat A' : 'Cat B'} • base {rupee(p.basePrice)}
                      </p>
                    </div>
                    {selected?.id === p.id && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div>
              <label className="text-[10px] uppercase tracking-wide text-zinc-500">Player name</label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40"
              />
              <p className="mt-1.5 text-[10px] text-zinc-600">For players in your team who aren’t in the directory (e.g. retained).</p>
            </div>
          )}

          {/* Price */}
          <div>
            <label className="text-[10px] uppercase tracking-wide text-zinc-500">Price paid</label>
            <div className="relative mt-1">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Amount"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={submit}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add to Squad
          </button>
        </div>
      </div>
    </div>
  );
}
