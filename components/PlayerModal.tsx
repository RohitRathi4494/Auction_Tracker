'use client';
import { useEffect, useState } from 'react';
import { Player } from '@/types';
import { X, ExternalLink, RefreshCw, Trophy, Star, Shield, User, Database, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/rules';

interface Props {
  player: Player;
  onClose: () => void;
}

function StatBox({ label, value, sub }: { label: string; value?: string | number; sub?: string }) {
  const empty = value === undefined || value === null || value === '';
  return (
    <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
      <p className="text-[10px] text-zinc-500 leading-tight">{label}</p>
      <p className={`text-sm font-bold mt-1 ${empty ? 'text-zinc-700' : 'text-white'}`}>
        {empty ? '—' : value}
      </p>
      {sub && !empty && <p className="text-[9px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PlayerModal({ player, onClose }: Props) {
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [localPlayer, setLocalPlayer] = useState({ ...player });

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleScrape = async () => {
    setScraping(true);
    setScrapeError('');
    try {
      const res = await fetch(`/api/scrape/${player.id}`);
      const data = await res.json();
      if (data.stats && Object.keys(data.stats).length > 0) {
        setLocalPlayer((prev) => ({ ...prev, ...data.stats }));
      } else {
        setScrapeError('No stats returned — data already loaded from Excel registration sheet.');
      }
    } catch {
      setScrapeError('Network error — please try again.');
    } finally {
      setScraping(false);
    }
  };

  const tierColor = localPlayer.tier === 'A'
    ? 'from-amber-500/20 to-amber-500/5 border-amber-500/30'
    : 'from-blue-500/20 to-blue-500/5 border-blue-500/30';

  const hasStats = localPlayer.battingAvg !== undefined || localPlayer.careerWickets !== undefined;
  const hasBowlingStats = localPlayer.careerWickets !== undefined || localPlayer.economy !== undefined;
  const hasFieldingStats = localPlayer.stumpings !== undefined || localPlayer.catches !== undefined || localPlayer.runOuts !== undefined;

  // Determine dominant role for stat display
  const role = localPlayer.playingAs.toLowerCase();
  const isWK = role.includes('wicket') || role.includes('keeper');
  const isBowler = role.includes('bowl') || role.includes('pacer') || role.includes('spin');
  const isAllrounder = role.includes('allrounder');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-xl bg-[oklch(0.15_0.015_250)] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header gradient */}
        <div className={`bg-gradient-to-br ${tierColor} p-5 border-b border-white/8`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  localPlayer.tier === 'A'
                    ? 'bg-amber-500/30 text-amber-300 border-amber-500/50'
                    : 'bg-blue-500/30 text-blue-300 border-blue-500/50'
                }`}>
                  {localPlayer.tier === 'A' && <Trophy className="w-2.5 h-2.5 inline mr-1" />}
                  Cat {localPlayer.tier} · {localPlayer.rawCategory}
                </span>
                {localPlayer.isLegend && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    <Star className="w-2.5 h-2.5 inline mr-1" />Legend
                  </span>
                )}
                {localPlayer.isOwner && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/20 text-blue-300 border border-blue-400/30">
                    <Shield className="w-2.5 h-2.5 inline mr-1" />Owner
                  </span>
                )}
                {localPlayer.isRetained && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                    <User className="w-2.5 h-2.5 inline mr-1" />Retained
                  </span>
                )}
                {localPlayer.statsSource === 'excel' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/20 text-green-300 border border-green-400/30">
                    <Database className="w-2.5 h-2.5 inline mr-1" />Stats from Excel
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white truncate">{localPlayer.fullName}</h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                {localPlayer.playingAs} · {localPlayer.battingStyle}
                {localPlayer.totalMatches !== undefined && (
                  <span className="text-zinc-600"> · {localPlayer.totalMatches} matches</span>
                )}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-zinc-400 hover:text-white flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Basic info row */}
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="Age" value={`${localPlayer.age.toFixed(1)} yrs`} />
            <StatBox label="Bracket" value={localPlayer.ageBracket === 'under_35' ? 'Under 35' : 'Above 35'} />
            <StatBox label="Base Price" value={formatCurrency(localPlayer.basePrice)} />
            {localPlayer.status === 'sold'
              ? <StatBox label="Sold" value={formatCurrency(localPlayer.soldPrice!)} sub={localPlayer.soldToTeamName} />
              : <StatBox label="Status" value={localPlayer.status} />
            }
          </div>

          {/* Bowling styles */}
          {localPlayer.bowlingStyles && localPlayer.bowlingStyles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {localPlayer.bowlingStyles.map((s) => (
                <span key={s} className="text-xs px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/30">{s}</span>
              ))}
            </div>
          )}

          {/* ── Batting Stats ─────────────────────────────────────────────── */}
          {hasStats && (
            <div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> Batting
              </p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                <StatBox label="Average" value={localPlayer.battingAvg?.toFixed(2)} />
                <StatBox label="Strike Rate" value={localPlayer.strikeRate?.toFixed(1)} />
                <StatBox label="Runs" value={localPlayer.battingRuns} />
                <StatBox label="Highest" value={localPlayer.highestScore} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <StatBox label="Innings" value={localPlayer.battingInnings} />
                <StatBox label="50s" value={localPlayer.fifties} />
                <StatBox label="100s" value={localPlayer.hundreds} />
                <StatBox label="Ducks" value={localPlayer.ducks} />
              </div>
              {(localPlayer.fours !== undefined || localPlayer.sixes !== undefined) && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <StatBox label="4s" value={localPlayer.fours} />
                  <StatBox label="6s" value={localPlayer.sixes} />
                  <StatBox label="30s" value={localPlayer.thirties} />
                </div>
              )}
            </div>
          )}

          {/* ── Bowling Stats ─────────────────────────────────────────────── */}
          {hasBowlingStats && (isBowler || isAllrounder || (localPlayer.careerWickets !== undefined && (localPlayer.careerWickets ?? 0) > 0)) && (
            <div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-2">⚾ Bowling</p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                <StatBox label="Wickets" value={localPlayer.careerWickets} />
                <StatBox label="Economy" value={localPlayer.economy?.toFixed(2)} />
                <StatBox label="Bowling Avg" value={localPlayer.bowlingAvg?.toFixed(2)} />
                <StatBox label="Best" value={localPlayer.bestBowling} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <StatBox label="Overs" value={localPlayer.overs?.toFixed(1)} />
                <StatBox label="Maidens" value={localPlayer.maidens} />
                <StatBox label="3W" value={localPlayer.threeWickets} />
                <StatBox label="5W" value={localPlayer.fiveWickets} />
              </div>
            </div>
          )}

          {/* ── Fielding / WK Stats ───────────────────────────────────────── */}
          {hasFieldingStats && (isWK || isAllrounder || (localPlayer.catches !== undefined && (localPlayer.catches ?? 0) > 0)) && (
            <div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-2">🧤 Fielding{isWK ? ' / Wicket-Keeping' : ''}</p>
              <div className="grid grid-cols-4 gap-2">
                {isWK && <StatBox label="Stumpings" value={localPlayer.stumpings} />}
                {isWK && <StatBox label="Caught Behind" value={localPlayer.caughtBehind} />}
                <StatBox label="Catches" value={localPlayer.catches} />
                <StatBox label="Run Outs" value={localPlayer.runOuts} />
              </div>
            </div>
          )}

          {/* No stats at all */}
          {!hasStats && (
            <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-sm text-zinc-500">No stats available for this player.</p>
              <p className="text-xs text-zinc-600 mt-1">Player may not have recorded games on CricHeroes.</p>
            </div>
          )}

          {/* Scrape refresh (fallback / supplement) */}
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleScrape}
                disabled={scraping}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/25 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${scraping ? 'animate-spin' : ''}`} />
                {scraping ? 'Fetching…' : 'Refresh from CricHeroes'}
              </button>
              <span className="text-[10px] text-zinc-700">(optional — stats already loaded from Excel)</span>
            </div>
            {scrapeError && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-2">{scrapeError}</p>
            )}
          </div>

          {/* CricHeroes link + phone */}
          <div className="flex items-center justify-between border-t border-white/6 pt-3">
            <a
              href={localPlayer.cricHeroesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors group"
            >
              <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              View on CricHeroes
            </a>
            <p className="text-xs text-zinc-700">📞 {localPlayer.phone}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
