'use client';
import { Team } from '@/types';
import { formatCurrency } from '@/lib/rules';
import { Wallet, Users, Trophy, AlertTriangle } from 'lucide-react';

interface Props {
  team: Team;
  isActive?: boolean;
  onClick?: () => void;
}

export default function TeamPurseCard({ team, isActive, onClick }: Props) {
  const pursePercent = Math.round((team.purseRemaining / team.totalPurse) * 100);
  const purseColor =
    pursePercent > 60 ? 'bg-emerald-500' : pursePercent > 30 ? 'bg-amber-500' : 'bg-rose-500';

  const squadWarning = team.squadCount >= 18;
  const purseWarning = team.purseRemaining < 20000;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-4 transition-all duration-200 ${
        isActive
          ? 'border-blue-500/60 bg-blue-500/10 shadow-lg shadow-blue-500/10'
          : 'border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/14'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Team name + group */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-white text-sm leading-tight">{team.name}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block font-medium ${
            team.group === 'Elite' ? 'bg-amber-500/20 text-amber-400' :
            team.group === 'Challengers' ? 'bg-blue-500/20 text-blue-400' :
            'bg-violet-500/20 text-violet-400'
          }`}>
            {team.group}
          </span>
        </div>
        <div className="flex gap-1">
          {squadWarning && <span title="Squad nearly full"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /></span>}
          {purseWarning && <span title="Low purse"><Wallet className="w-3.5 h-3.5 text-rose-400" /></span>}
        </div>
      </div>

      {/* Purse bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
          <span>Purse</span>
          <span>{pursePercent}% remaining</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${purseColor}`}
            style={{ width: `${pursePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-zinc-400">{formatCurrency(team.purseRemaining)} left</span>
          <span className="text-zinc-600">of {formatCurrency(team.totalPurse)}</span>
        </div>
      </div>

      {/* Squad stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white/5 rounded-lg p-2">
          <Users className="w-3 h-3 text-zinc-500 mx-auto mb-0.5" />
          <p className="text-xs font-bold text-white">{team.squadCount}<span className="text-zinc-600 font-normal">/20</span></p>
          <p className="text-[9px] text-zinc-600">Squad</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <Trophy className="w-3 h-3 text-amber-500/70 mx-auto mb-0.5" />
          <p className="text-xs font-bold text-white">{team.categoryACount}<span className="text-zinc-600 font-normal">/6</span></p>
          <p className="text-[9px] text-zinc-600">Cat A</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <span className="block text-[9px] text-zinc-500 mb-0.5">30-35</span>
          <p className="text-xs font-bold text-white">{team.age3035Count}<span className="text-zinc-600 font-normal">/3</span></p>
          <p className="text-[9px] text-zinc-600">Age cap</p>
        </div>
      </div>
    </div>
  );
}
