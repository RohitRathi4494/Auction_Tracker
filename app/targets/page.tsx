'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Player, Tier, PlayerStatus, TargetStatus, WishlistSnapshot, TargetMeta } from '@/types';
import { formatCurrency } from '@/lib/rules';
import {
  ArrowLeft, Target, Trophy, Loader2, Trash2, Zap, Wind, Check,
  Crosshair, TrendingUp, TrendingDown,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────
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

function getBowlingLabel(styles: string[] | undefined): string | null {
  if (!styles || styles.length === 0) return null;
  const raw = styles[0]?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const hand = lower.includes('left') ? 'LA' : lower.includes('right') ? 'RA' : '';
  let type = '';
  if (lower.includes('fast') || lower.includes('pace')) type = 'Fast';
  else if (lower.includes('medium')) type = 'Medium';
  else if (lower.includes('leg')) type = 'Leg Spin';
  else if (lower.includes('off')) type = 'Off Spin';
  else if (lower.includes('spin')) type = 'Spin';
  if (hand && type) return `${hand} ${type}`;
  if (hand) return `${hand} Arm`;
  return raw.length > 20 ? raw.substring(0, 18) + '…' : raw;
}

const STATUS_LABELS: Record<TargetStatus, string> = {
  targeting: 'Targeting',
  bought: 'Bought by me',
  lost: 'Sold to other team',
};

const STATUS_STYLES: Record<TargetStatus, string> = {
  targeting: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  bought: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  lost: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

// Grouping options for the board.
type GroupBy = 'category' | 'role';

// Colour tones reused for both category and role group pills.
const TONES: Record<string, string> = {
  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  zinc: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

// Broad role buckets (order = display order).
const ROLE_ORDER = ['Batsman', 'All-rounder', 'Bowler', 'Wicket-Keeper', 'Other'] as const;
const ROLE_TONE: Record<string, string> = {
  Batsman: 'amber',
  'All-rounder': 'violet',
  Bowler: 'rose',
  'Wicket-Keeper': 'cyan',
  Other: 'zinc',
};

function roleBucket(playingAs?: string): string {
  const s = (playingAs ?? '').toLowerCase();
  if (!s) return 'Other';
  if (s.includes('keeper')) return 'Wicket-Keeper';
  if (s.includes('allrounder') || s.includes('all-rounder') || s.includes('all rounder')) return 'All-rounder';
  if (s.includes('bat')) return 'Batsman';
  if (s.includes('bowl') || s.includes('pace') || s.includes('spin') || s.includes('fast') || s.includes('medium')) return 'Bowler';
  return 'Other';
}

interface Group {
  key: string;
  label: string;
  tone: string;
  players: TargetEntry[];
}

// ─── Merged target entry (live player data ⊕ snapshot ⊕ target meta) ──────────
interface TargetEntry {
  id: string;
  fullName: string;
  playingAs?: string;
  bowlingStyles?: string[];
  battingStyle?: string;
  tier: Tier;
  age?: number;
  basePrice?: number;
  liveStatus?: PlayerStatus;
  soldToTeamId?: string;
  soldToTeamName?: string;
  soldPrice?: number;
  battingAvg?: number;
  strikeRate?: number;
  careerWickets?: number;
  economy?: number;
  inDirectory: boolean;
  priority?: number;
  targetStatus: TargetStatus;
}

export default function TargetsPage() {
  const [entries, setEntries] = useState<TargetEntry[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('category');

  const load = useCallback(async () => {
    const [initRes, wlRes] = await Promise.all([
      fetch('/api/init', { credentials: 'include' }),
      fetch('/api/wishlist', { credentials: 'include' }),
    ]);
    const init = await initRes.json();
    const wl = await wlRes.json();

    const players: Player[] = Array.isArray(init.players) ? init.players : [];
    const byId = new Map(players.map((p) => [p.id, p]));
    const ids: string[] = Array.isArray(wl.playerIds) ? wl.playerIds : [];
    const items: Record<string, WishlistSnapshot> = wl.items ?? {};
    const targets: Record<string, TargetMeta> = wl.targets ?? {};

    setTeamId(init.user?.teamId ?? null);

    const merged: TargetEntry[] = ids.map((id) => {
      const p = byId.get(id);
      const snap = items[id];
      const meta = targets[id] ?? {};
      return {
        id,
        fullName: p?.fullName ?? snap?.fullName ?? '(removed player)',
        playingAs: p?.playingAs ?? snap?.playingAs,
        bowlingStyles: p?.bowlingStyles,
        battingStyle: p?.battingStyle,
        tier: (p?.tier ?? snap?.tier ?? 'B') as Tier,
        age: p?.age ?? snap?.age,
        basePrice: p?.basePrice ?? snap?.basePrice,
        liveStatus: p?.status ?? snap?.status,
        soldToTeamId: p?.soldToTeamId,
        soldToTeamName: p?.soldToTeamName,
        soldPrice: p?.soldPrice,
        battingAvg: p?.battingAvg,
        strikeRate: p?.strikeRate,
        careerWickets: p?.careerWickets,
        economy: p?.economy,
        inDirectory: !!p,
        priority: meta.priority,
        targetStatus: meta.status ?? 'targeting',
      };
    });
    setEntries(merged);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Persist a priority/status change (optimistic).
  const saveMeta = useCallback(async (id: string, patch: { priority?: number | null; status?: TargetStatus }) => {
    setEntries((prev) => prev.map((e) => e.id === id
      ? {
          ...e,
          ...(patch.priority !== undefined ? { priority: patch.priority ?? undefined } : {}),
          ...(patch.status !== undefined ? { targetStatus: patch.status } : {}),
        }
      : e));
    setSavingId(id);
    try {
      await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'update_meta', playerId: id, ...patch }),
      });
    } finally {
      setSavingId(null);
    }
  }, []);

  const removeTarget = useCallback(async (id: string) => {
    setRemovingId(id);
    try {
      await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ playerId: id }),
      });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setRemovingId(null);
    }
  }, []);

  // Group by category (Cat A / Cat B) or by role bucket — each group carries its
  // own priority ordering (sorted by priority, then name).
  const groups = useMemo<Group[]>(() => {
    const sortFn = (a: TargetEntry, b: TargetEntry) => {
      const pa = a.priority ?? Number.POSITIVE_INFINITY;
      const pb = b.priority ?? Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa - pb;
      return a.fullName.localeCompare(b.fullName);
    };

    if (groupBy === 'role') {
      return ROLE_ORDER
        .map((name) => ({
          key: name,
          label: name,
          tone: ROLE_TONE[name],
          players: entries.filter((e) => roleBucket(e.playingAs) === name).sort(sortFn),
        }))
        .filter((g) => g.players.length > 0);
    }

    // Category — always show both A and B sections.
    return (['A', 'B'] as Tier[]).map((tier) => ({
      key: tier,
      label: `Category ${tier}`,
      tone: tier === 'A' ? 'amber' : 'sky',
      players: entries.filter((e) => e.tier === tier).sort(sortFn),
    }));
  }, [entries, groupBy]);

  const summary = useMemo(() => ({
    total: entries.length,
    targeting: entries.filter((e) => e.targetStatus === 'targeting').length,
    bought: entries.filter((e) => e.targetStatus === 'bought').length,
    lost: entries.filter((e) => e.targetStatus === 'lost').length,
  }), [entries]);

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
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white leading-none">My Targets</h1>
                <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Players to bid for</p>
              </div>
            </div>
          </div>
          <a
            href="/squad"
            className="text-xs text-zinc-400 hover:text-emerald-300 bg-white/5 hover:bg-emerald-500/10 border border-white/10 px-3 py-2 rounded-xl transition-all"
          >
            My Squad
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Crosshair, label: 'Targets', value: summary.total, color: 'text-blue-400' },
            { icon: Target, label: 'Still chasing', value: summary.targeting, color: 'text-amber-400' },
            { icon: TrendingUp, label: 'Bought by me', value: summary.bought, color: 'text-emerald-400' },
            { icon: TrendingDown, label: 'Lost to others', value: summary.lost, color: 'text-rose-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white/4 rounded-2xl border border-white/8 p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
              <div>
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="text-xl font-bold text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Grouping toggle */}
        {!loading && entries.length > 0 && (
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[11px] uppercase tracking-wide text-zinc-600">Group by</span>
            <div className="inline-flex rounded-xl border border-white/10 bg-white/4 p-0.5">
              {([
                { key: 'category' as GroupBy, label: 'Category', icon: Trophy },
                { key: 'role' as GroupBy, label: 'Role', icon: Zap },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setGroupBy(key)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                    groupBy === key ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30' : 'text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-24 text-zinc-500">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No targets yet</p>
            <p className="text-sm mt-1">
              Shortlist players from the{' '}
              <a href="/directory" className="text-rose-400 hover:text-rose-300 underline">Directory</a>{' '}
              (tap the ♥ on a player) to build your bidding list.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${TONES[g.tone]}`}>
                    {groupBy === 'category' ? <Trophy className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                    {g.label}
                  </span>
                  <span className="text-xs text-zinc-600">{g.players.length} player{g.players.length !== 1 ? 's' : ''}</span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>

                {g.players.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-2">No {g.label} targets.</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {g.players.map((e) => (
                      <TargetRow
                        key={e.id}
                        entry={e}
                        teamId={teamId}
                        saving={savingId === e.id}
                        removing={removingId === e.id}
                        onSaveMeta={saveMeta}
                        onRemove={removeTarget}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Single target card ───────────────────────────────────────────────────────
function TargetRow({
  entry, teamId, saving, removing, onSaveMeta, onRemove,
}: {
  entry: TargetEntry;
  teamId: string | null;
  saving: boolean;
  removing: boolean;
  onSaveMeta: (id: string, patch: { priority?: number | null; status?: TargetStatus }) => void;
  onRemove: (id: string) => void;
}) {
  const [priorityInput, setPriorityInput] = useState(
    entry.priority !== undefined ? String(entry.priority) : ''
  );
  useEffect(() => {
    setPriorityInput(entry.priority !== undefined ? String(entry.priority) : '');
  }, [entry.priority]);

  const commitPriority = () => {
    const trimmed = priorityInput.trim();
    const val = trimmed === '' ? null : Number(trimmed);
    const current = entry.priority ?? null;
    if (val === current) return;
    if (val !== null && (!Number.isFinite(val) || val < 0)) {
      setPriorityInput(entry.priority !== undefined ? String(entry.priority) : '');
      return;
    }
    onSaveMeta(entry.id, { priority: val });
  };

  const roleStyle = entry.playingAs
    ? roleColors[entry.playingAs] ?? 'text-zinc-300 bg-zinc-300/10 border-zinc-300/30'
    : '';
  const bowlingLabel = getBowlingLabel(entry.bowlingStyles);
  const hasStats = entry.battingAvg || entry.careerWickets !== undefined;

  // Live auction reference (secondary info; the status dropdown is what the owner tracks).
  let liveHint: string | null = null;
  if (entry.liveStatus === 'sold') {
    const wonByMe = teamId && entry.soldToTeamId === teamId;
    const price = entry.soldPrice !== undefined ? ` · ${formatCurrency(entry.soldPrice)}` : '';
    liveHint = wonByMe
      ? `Live: won by you${price}`
      : `Live: sold to ${entry.soldToTeamName ?? 'another team'}${price}`;
  } else if (entry.liveStatus === 'in_auction') {
    liveHint = 'Live: in auction now';
  } else if (entry.liveStatus === 'unsold') {
    liveHint = 'Live: unsold';
  }

  return (
    <div className="relative rounded-2xl border border-white/8 bg-white/4 p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Priority badge */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <label className="text-[9px] uppercase tracking-wide text-zinc-600">Priority</label>
          <input
            type="text"
            inputMode="numeric"
            value={priorityInput}
            onChange={(ev) => setPriorityInput(ev.target.value)}
            onBlur={commitPriority}
            onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
            placeholder="–"
            className="w-11 h-11 text-center rounded-xl bg-black/30 border border-white/12 text-lg font-bold text-white focus:outline-none focus:border-rose-500/50"
          />
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{entry.fullName}</h3>
            {!entry.inDirectory && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 border border-white/10">
                off-directory
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {[
              entry.age !== undefined ? `${entry.age.toFixed(1)}y` : null,
              entry.battingStyle || null,
              entry.basePrice !== undefined ? `base ${formatCurrency(entry.basePrice)}` : null,
            ].filter(Boolean).join(' • ')}
          </p>

          {/* Role + bowling */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {entry.playingAs && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg border ${roleStyle}`}>
                <Zap className="w-2.5 h-2.5" /> {entry.playingAs}
              </span>
            )}
            {bowlingLabel && (
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                <Wind className="w-2.5 h-2.5 text-zinc-500" /> {bowlingLabel}
              </span>
            )}
          </div>

          {/* Stats */}
          {hasStats && (
            <div className="flex gap-4 mt-2 text-[11px]">
              {entry.battingAvg !== undefined && (
                <div className="flex flex-col"><span className="text-zinc-500">Avg</span><span className="text-white font-semibold">{entry.battingAvg.toFixed(1)}</span></div>
              )}
              {entry.strikeRate !== undefined && (
                <div className="flex flex-col"><span className="text-zinc-500">SR</span><span className="text-white font-semibold">{entry.strikeRate.toFixed(1)}</span></div>
              )}
              {entry.careerWickets !== undefined && (
                <div className="flex flex-col"><span className="text-zinc-500">Wkts</span><span className="text-white font-semibold">{entry.careerWickets}</span></div>
              )}
              {entry.economy !== undefined && (
                <div className="flex flex-col"><span className="text-zinc-500">Econ</span><span className="text-white font-semibold">{entry.economy.toFixed(2)}</span></div>
              )}
            </div>
          )}

          {/* Status control */}
          <div className="flex items-center gap-2 mt-3">
            <select
              value={entry.targetStatus}
              onChange={(ev) => onSaveMeta(entry.id, { status: ev.target.value as TargetStatus })}
              className={`text-[11px] font-medium px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${STATUS_STYLES[entry.targetStatus]}`}
            >
              {(Object.keys(STATUS_LABELS) as TargetStatus[]).map((s) => (
                <option key={s} value={s} className="bg-zinc-900 text-white">{STATUS_LABELS[s]}</option>
              ))}
            </select>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />}
            {!saving && <Check className="w-3.5 h-3.5 text-emerald-500/60" />}
          </div>

          {liveHint && (
            <p className="text-[10px] text-zinc-600 mt-1.5">{liveHint}</p>
          )}
        </div>

        {/* Remove */}
        <button
          onClick={() => onRemove(entry.id)}
          disabled={removing}
          title="Remove from targets"
          className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40 flex-shrink-0"
        >
          {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
