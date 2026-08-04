'use client';
import { use, useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Team, Player, AuctionState } from '@/types';
import { formatCurrency } from '@/lib/rules';
import { Wallet, Users, Trophy, Gavel, Star, Shield, User, AlertCircle } from 'lucide-react';

export default function LiveTeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const [team, setTeam] = useState<Team | null>(null);
  const [squad, setSquad] = useState<Player[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentBidTeam, setCurrentBidTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  // Realtime team subscription
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'teams', teamId), async (snap) => {
      if (snap.exists()) {
        const teamData = { id: snap.id, ...snap.data() } as Team;
        setTeam(teamData);

        // Load squad members
        const squadSnap = await getDocs(
          query(collection(db, 'players'), where('soldToTeamId', '==', teamId)),
        );
        setSquad(squadSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Player)));
        setLoading(false);
      }
    });
    return unsub;
  }, [teamId]);

  // Realtime auction state
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'auction', 'state'), async (snap) => {
      if (snap.exists()) {
        const state = snap.data() as AuctionState;
        setAuctionState(state);

        if (state.currentPlayerId) {
          const pSnap = await getDocs(
            query(collection(db, 'players'), where('__name__', '==', state.currentPlayerId)),
          );
          if (!pSnap.empty) setCurrentPlayer({ id: pSnap.docs[0].id, ...pSnap.docs[0].data() } as Player);
        } else {
          setCurrentPlayer(null);
        }

        if (state.currentBidTeamId) {
          const tSnap = await getDocs(
            query(collection(db, 'teams'), where('__name__', '==', state.currentBidTeamId)),
          );
          if (!tSnap.empty) setCurrentBidTeam({ id: tSnap.docs[0].id, ...tSnap.docs[0].data() } as Team);
        } else {
          setCurrentBidTeam(null);
        }
      }
    });
    return unsub;
  }, []);

  const pursePercent = team ? Math.round((team.purseRemaining / team.totalPurse) * 100) : 0;
  const purseColor = pursePercent > 60 ? 'bg-emerald-500' : pursePercent > 30 ? 'bg-amber-500' : 'bg-rose-500';

  if (loading) {
    return (
      <div className="min-h-screen bg-[oklch(0.12_0.01_250)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-zinc-500 text-sm">Loading team data…</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-[oklch(0.12_0.01_250)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <p className="text-white font-semibold">Team not found</p>
          <p className="text-zinc-500 text-sm mt-1">Check your link</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.12_0.01_250)] pb-8">
      {/* Header */}
      <div className="bg-gradient-to-b from-blue-900/40 to-transparent px-4 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            team.group === 'Elite' ? 'bg-amber-500/20 text-amber-400' :
            team.group === 'Challengers' ? 'bg-blue-500/20 text-blue-400' :
            'bg-violet-500/20 text-violet-400'
          }`}>{team.group}</span>
        </div>
        <h1 className="text-2xl font-bold text-white">{team.name}</h1>
        {team.owners.length > 0 && (
          <p className="text-xs text-zinc-500 mt-1">Owners: {team.owners.join(', ')}</p>
        )}
      </div>

      <div className="px-4 space-y-4">
        {/* Live auction status */}
        {auctionState?.phase === 'bidding' && currentPlayer && (
          <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Live Auction</span>
            </div>
            <p className="text-lg font-bold text-white">{currentPlayer.fullName}</p>
            <p className="text-xs text-zinc-400">{currentPlayer.playingAs} · Cat {currentPlayer.tier}</p>
            <div className="flex items-end justify-between mt-3">
              <div>
                <p className="text-xs text-zinc-500">Current Bid</p>
                <p className="text-2xl font-black text-white">{formatCurrency(auctionState.currentBid)}</p>
              </div>
              {currentBidTeam && (
                <div className="text-right">
                  <p className="text-xs text-zinc-500">Leading</p>
                  <p className={`text-sm font-bold ${currentBidTeam.id === teamId ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {currentBidTeam.id === teamId ? '🟢 YOU' : currentBidTeam.name}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {auctionState?.phase === 'idle' && (
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4 flex items-center gap-3">
            <Gavel className="w-5 h-5 text-zinc-600" />
            <p className="text-sm text-zinc-500">Waiting for next player…</p>
          </div>
        )}

        {/* Purse card */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-300">Purse</h2>
          </div>
          <div className="flex items-end justify-between mb-2">
            <p className="text-3xl font-black text-white">{formatCurrency(team.purseRemaining)}</p>
            <p className="text-sm text-zinc-500">of {formatCurrency(team.totalPurse)}</p>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${purseColor}`} style={{ width: `${pursePercent}%` }} />
          </div>
          <p className="text-xs text-zinc-600 mt-1 text-right">{pursePercent}% remaining</p>
        </div>

        {/* Squad caps */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Users, label: 'Squad', value: `${team.squadCount}/20`, warn: team.squadCount >= 18 },
            { icon: Trophy, label: 'Cat A', value: `${team.categoryACount}/6`, warn: team.categoryACount >= 6 },
            { icon: Star, label: '30–35 Age', value: `${team.age3035Count}/3`, warn: team.age3035Count >= 3 },
          ].map(({ icon: Icon, label, value, warn }) => (
            <div key={label} className={`rounded-xl p-3 text-center border ${warn ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/4 border-white/8'}`}>
              <Icon className={`w-4 h-4 mx-auto mb-1 ${warn ? 'text-amber-400' : 'text-zinc-500'}`} />
              <p className={`text-sm font-bold ${warn ? 'text-amber-300' : 'text-white'}`}>{value}</p>
              <p className="text-[10px] text-zinc-600">{label}</p>
            </div>
          ))}
        </div>

        {/* Squad minimum warning */}
        {team.squadCount < 16 && (
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <p className="text-xs text-rose-300">Need {16 - team.squadCount} more players to meet minimum squad of 16</p>
          </div>
        )}

        {/* Squad list */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" /> My Squad ({squad.length})
          </h2>
          {squad.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-6">No players in squad yet</p>
          ) : (
            <div className="space-y-2">
              {/* Group by role */}
              {squad.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/4 hover:bg-white/6 transition-colors">
                  <div className="flex-shrink-0 flex gap-1">
                    {p.tier === 'A' && <Trophy className="w-3 h-3 text-amber-400" />}
                    {p.isLegend && <Star className="w-3 h-3 text-amber-300" />}
                    {p.isOwner && <Shield className="w-3 h-3 text-blue-400" />}
                    {p.isRetained && <User className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.fullName}</p>
                    <p className="text-[10px] text-zinc-500">{p.playingAs}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-emerald-400">{p.soldPrice ? formatCurrency(p.soldPrice) : 'Owner/Retained'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Retained players */}
        {team.retainedPlayers.length > 0 && (
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-emerald-400" /> Retained Players
            </h2>
            <div className="space-y-1.5">
              {team.retainedPlayers.map((name) => (
                <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                  <User className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-emerald-300">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
