'use client';
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Player, Team, AuctionState, AuctionLogEntry, RuleViolation } from '@/types';
import { validateBid, getBidIncrement, formatCurrency } from '@/lib/rules';
import TeamPurseCard from '@/components/TeamPurseCard';
import RuleAlert from '@/components/RuleAlert';
import {
  Gavel, ChevronRight, Check, X, AlertTriangle, Shuffle, SkipForward,
  Undo2, Download, LogOut, Search, Trophy, Clock, Users
} from 'lucide-react';

export default function AuctionConsolePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [auctionLog, setAuctionLog] = useState<AuctionLogEntry[]>([]);

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [bidAmount, setBidAmount] = useState(0);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tiebreakerBids, setTiebreakerBids] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      const [psSnap, tsSnap] = await Promise.all([
        getDocs(query(collection(db, 'players'), orderBy('fullName'))),
        getDocs(collection(db, 'teams')),
      ]);
      setPlayers(psSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Player)));
      setTeams(tsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Team)));
    };
    loadData();
  }, []);

  // Realtime auction state
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'auction', 'state'), (snap) => {
      if (snap.exists()) setAuctionState(snap.data() as AuctionState);
    });
    return unsub;
  }, []);

  // Realtime auction log
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'auctionLog'), orderBy('timestamp', 'desc'), limit(20)),
      (snap) => setAuctionLog(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuctionLogEntry)))
    );
    return unsub;
  }, []);

  // Sync current player when auction state changes
  useEffect(() => {
    if (auctionState?.currentPlayerId) {
      const p = players.find((x) => x.id === auctionState.currentPlayerId) ?? null;
      setCurrentPlayer(p);
      if (p) setBidAmount(auctionState.currentBid || p.basePrice);
    } else {
      setCurrentPlayer(null);
    }
  }, [auctionState, players]);

  // Validate bid on change
  useEffect(() => {
    if (!currentPlayer || !selectedTeam || !bidAmount) { setViolations([]); return; }
    const team = teams.find((t) => t.id === selectedTeam);
    if (!team) return;
    const v = validateBid(currentPlayer, team, bidAmount, auctionState?.currentBid ?? 0);
    setViolations(v);
  }, [currentPlayer, selectedTeam, bidAmount, auctionState, teams]);

  const apiCall = async (action: string, extra: Record<string, unknown> = {}) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auction/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      // Refresh players
      const snap = await getDocs(query(collection(db, 'players'), orderBy('fullName')));
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Player)));
      // Refresh teams
      const tSnap = await getDocs(collection(db, 'teams'));
      setTeams(tSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Team)));
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const drawRandomPlayer = () => {
    const available = players.filter((p) => p.status === 'available');
    if (!available.length) { alert('No available players!'); return; }
    const random = available[Math.floor(Math.random() * available.length)];
    apiCall('draw', { playerId: random.id });
  };

  const drawSpecificPlayer = (playerId: string) => apiCall('draw', { playerId });

  const placeBid = () => {
    if (violations.some((v) => v.type === 'error')) return;
    apiCall('bid', { teamId: selectedTeam, amount: bidAmount, playerId: currentPlayer?.id });
  };

  const markSold = () => {
    if (!currentPlayer || !auctionState?.currentBidTeamId) return;
    apiCall('sold', { playerId: currentPlayer.id, teamId: auctionState.currentBidTeamId, amount: auctionState.currentBid });
  };

  const markUnsold = () => {
    if (!currentPlayer) return;
    apiCall('unsold', { playerId: currentPlayer.id });
  };

  const triggerTiebreaker = () => {
    apiCall('tiebreaker', { team1Id: selectedTeam, team2Id: auctionState?.currentBidTeamId });
  };

  const submitTiebreaker = () => {
    const bids = Object.entries(tiebreakerBids);
    if (bids.length < 2) { alert('Enter bids for both teams'); return; }
    const sorted = bids.sort(([, a], [, b]) => parseInt(b) - parseInt(a));
    const winner = sorted[0];
    apiCall('sold', { playerId: currentPlayer?.id, teamId: winner[0], amount: parseInt(winner[1]) });
  };

  const availablePlayers = players.filter((p) =>
    p.status === 'available' &&
    (searchQuery ? p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) : true),
  );

  const increment = currentPlayer ? getBidIncrement(currentPlayer) : 5000;

  return (
    <div className="min-h-screen bg-[oklch(0.12_0.01_250)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[oklch(0.12_0.01_250)]/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a href="/admin/import" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors">
              Import Data
            </a>
            <a href="/admin/users" className="text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg transition-colors">
              Manage Users
            </a>
            <button 
              onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/login'; }} 
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Gavel className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">SCCL Auction Console</h1>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className={`w-1.5 h-1.5 rounded-full ${auctionState?.phase === 'bidding' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                {auctionState?.phase === 'idle' ? 'Idle' : auctionState?.phase === 'bidding' ? 'Live bidding' : auctionState?.phase ?? 'Loading'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/directory" className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-white/8 transition-colors">Directory</a>
            <a
              href="/api/export"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_380px_320px] gap-4">

        {/* ── LEFT: Player on the block ───────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Draw controls */}
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><Shuffle className="w-4 h-4" /> Draw Player</h2>
              <span className="text-xs text-zinc-600">{availablePlayers.length} available</span>
            </div>
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search player to draw…"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-white/6 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/40"
                />
              </div>
              <button
                onClick={drawRandomPlayer}
                disabled={loading || auctionState?.phase === 'bidding'}
                className="px-4 py-2 text-xs rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-40 transition-all font-medium flex items-center gap-1.5"
              >
                <Shuffle className="w-3.5 h-3.5" /> Random
              </button>
            </div>
            {searchQuery && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {availablePlayers.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { drawSpecificPlayer(p.id); setSearchQuery(''); }}
                    disabled={loading || auctionState?.phase === 'bidding'}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/8 text-zinc-300 flex items-center justify-between disabled:opacity-40 transition-colors"
                  >
                    <span>{p.fullName}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${p.tier === 'A' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>Cat {p.tier}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active player block */}
          {currentPlayer ? (
            <div className="bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-500/25 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-blue-400 font-medium uppercase tracking-wider mb-1">🔴 On the Block</p>
                  <h2 className="text-2xl font-bold text-white">{currentPlayer.fullName}</h2>
                  <p className="text-sm text-zinc-400 mt-0.5">{currentPlayer.playingAs} · {currentPlayer.rawCategory}</p>
                </div>
                <span className={`text-sm font-bold px-3 py-1.5 rounded-xl ${currentPlayer.tier === 'A' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                  {currentPlayer.tier === 'A' && <Trophy className="w-3.5 h-3.5 inline mr-1" />}Cat {currentPlayer.tier}
                </span>
              </div>

              {/* Base price + current bid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/6 rounded-xl p-3">
                  <p className="text-xs text-zinc-500">Base Price</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(currentPlayer.basePrice)}</p>
                </div>
                <div className="bg-blue-500/15 border border-blue-500/25 rounded-xl p-3">
                  <p className="text-xs text-blue-400">Current Bid</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(auctionState?.currentBid ?? currentPlayer.basePrice)}</p>
                  {auctionState?.currentBidTeamId && (
                    <p className="text-[10px] text-blue-300 mt-0.5 truncate">
                      {teams.find((t) => t.id === auctionState.currentBidTeamId)?.name ?? ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Bid entry */}
              {auctionState?.phase === 'bidding' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select
                      value={selectedTeam}
                      onChange={(e) => setSelectedTeam(e.target.value)}
                      className="flex-1 text-sm py-2.5 px-3 rounded-xl bg-white/6 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="">Select team…</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (₹{(t.purseRemaining / 1000).toFixed(0)}K left)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => setBidAmount((prev) => Math.max(currentPlayer.basePrice, prev - increment))}
                      className="w-10 h-10 rounded-xl bg-white/8 border border-white/12 text-zinc-300 hover:bg-white/12 transition-colors font-bold text-lg"
                    >−</button>
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(parseInt(e.target.value) || 0)}
                      step={increment}
                      className="flex-1 text-center text-lg font-bold py-2 rounded-xl bg-white/6 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    />
                    <button
                      onClick={() => setBidAmount((prev) => Math.min(50000, prev + increment))}
                      className="w-10 h-10 rounded-xl bg-white/8 border border-white/12 text-zinc-300 hover:bg-white/12 transition-colors font-bold text-lg"
                    >+</button>
                  </div>
                  <p className="text-[10px] text-center text-zinc-600">Increment: {formatCurrency(increment)} per bid</p>

                  <RuleAlert violations={violations} />

                  <button
                    onClick={placeBid}
                    disabled={loading || !selectedTeam || violations.some((v) => v.type === 'error')}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity text-sm"
                  >
                    Place Bid — {formatCurrency(bidAmount)}
                  </button>
                </div>
              )}

              {/* Tiebreaker mode */}
              {auctionState?.phase === 'tiebreaker' && (
                <div className="space-y-3 bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Tie-Breaker Mode</p>
                  <p className="text-xs text-zinc-400">Both teams submit a sealed bid (₹50K–₹1L). Highest wins.</p>
                  {auctionState.tiebreakerTeams.map((tid) => {
                    const t = teams.find((x) => x.id === tid);
                    return (
                      <div key={tid} className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400 w-32 truncate">{t?.name}</span>
                        <input
                          type="number"
                          placeholder="50000 – 100000"
                          value={tiebreakerBids[tid] ?? ''}
                          onChange={(e) => setTiebreakerBids((prev) => ({ ...prev, [tid]: e.target.value }))}
                          className="flex-1 text-sm py-1.5 px-3 rounded-lg bg-white/8 border border-white/12 text-white focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    );
                  })}
                  <button onClick={submitTiebreaker} className="w-full py-2.5 rounded-xl bg-amber-500/30 text-amber-300 border border-amber-500/40 font-medium text-sm hover:bg-amber-500/40 transition-colors">
                    Submit & Declare Winner
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={markSold}
                  disabled={loading || !auctionState?.currentBidTeamId}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 transition-all text-sm font-medium"
                >
                  <Check className="w-4 h-4" /> Sold!
                </button>
                <button
                  onClick={markUnsold}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-500/20 text-zinc-400 border border-zinc-500/30 hover:bg-zinc-500/30 disabled:opacity-40 transition-all text-sm font-medium"
                >
                  <X className="w-4 h-4" /> Unsold
                </button>
                <button
                  onClick={triggerTiebreaker}
                  disabled={loading || !selectedTeam || !auctionState?.currentBidTeamId}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-40 transition-all text-sm font-medium"
                >
                  <AlertTriangle className="w-4 h-4" /> Tie
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/4 border border-white/8 rounded-2xl p-8 text-center">
              <Gavel className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Draw a player to begin bidding</p>
            </div>
          )}

          {/* Auction log */}
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-3"><Clock className="w-4 h-4" /> Recent Activity</h3>
            {auctionLog.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">No bids yet</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {auctionLog.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/4 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-medium truncate">{entry.playerName}</span>
                      {entry.teamName && <span className="text-zinc-500"> → {entry.teamName}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-zinc-400">{entry.bidAmount ? formatCurrency(entry.bidAmount) : '—'}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        entry.action === 'sold' ? 'bg-emerald-500/20 text-emerald-400' :
                        entry.action === 'undo' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-zinc-500/20 text-zinc-400'
                      }`}>{entry.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── MIDDLE: Team purses ─────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-3 px-1"><Users className="w-4 h-4" /> Team Purses</h2>
          <div className="space-y-2 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            {teams.map((team) => (
              <TeamPurseCard
                key={team.id}
                team={team}
                isActive={team.id === auctionState?.currentBidTeamId}
                onClick={() => setSelectedTeam(team.id)}
              />
            ))}
          </div>
        </div>

        {/* ── RIGHT: Available players list ───────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 px-1">Available Players ({players.filter(p => p.status === 'available').length})</h2>
          <div className="space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            {['A', 'B'].map((tier) =>
              players
                .filter((p) => p.status === 'available' && p.tier === tier)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => drawSpecificPlayer(p.id)}
                    disabled={loading || auctionState?.phase === 'bidding'}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/8 disabled:opacity-40 transition-all group flex items-center gap-2"
                  >
                    <span className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-[9px] font-bold ${tier === 'A' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{tier}</span>
                    <span className="text-xs text-zinc-300 group-hover:text-white transition-colors truncate flex-1">{p.fullName}</span>
                    <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 flex-shrink-0" />
                  </button>
                )),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
