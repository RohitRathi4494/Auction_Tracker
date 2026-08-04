'use client';
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Player } from '@/types';
import PlayerCard from '@/components/PlayerCard';
import PlayerModal from '@/components/PlayerModal';
import { Search, Filter, X, Gavel, BarChart3, Users, Trophy } from 'lucide-react';

const ROLES = [
  'Batsman', 'Batting Allrounder', 'Spin Bowling Allrounder', 'Fast Bowling Allrounder',
  'Leg Spin Bowler', 'Off Spin Bowler', 'Medium Pacer', 'Fast Bowler', 'Wicket Keeper Batsman',
];

export default function DirectoryPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState<'all' | 'A' | 'B'>('all');
  const [filterAge, setFilterAge] = useState<'all' | 'under_35' | 'above_35'>('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'sold' | 'unsold'>('all');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'players'), orderBy('fullName')));
        setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Player)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (search && !p.fullName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTier !== 'all' && p.tier !== filterTier) return false;
      if (filterAge !== 'all' && p.ageBracket !== filterAge) return false;
      if (filterRole !== 'all' && p.playingAs !== filterRole) return false;
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      return true;
    });
  }, [players, search, filterTier, filterAge, filterRole, filterStatus]);

  const stats = useMemo(() => ({
    total: players.length,
    available: players.filter((p) => p.status === 'available').length,
    sold: players.filter((p) => p.status === 'sold').length,
    catA: players.filter((p) => p.tier === 'A').length,
  }), [players]);

  const activeFilters = [filterTier !== 'all', filterAge !== 'all', filterRole !== 'all', filterStatus !== 'all'].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[oklch(0.12_0.01_250)]">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[oklch(0.12_0.01_250)]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Gavel className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">SCCL Season 6</h1>
              <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Player Directory</p>
            </div>
          </div>
          <nav className="flex gap-1 ml-4">
            <a href="/directory" className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 font-medium">Directory</a>
            <a href="/auction" className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-white/8 hover:text-white transition-colors">Auction</a>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: 'Total', value: stats.total, color: 'text-blue-400' },
            { icon: BarChart3, label: 'Available', value: stats.available, color: 'text-emerald-400' },
            { icon: Gavel, label: 'Sold', value: stats.sold, color: 'text-rose-400' },
            { icon: Trophy, label: 'Category A', value: stats.catA, color: 'text-amber-400' },
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

        {/* Search + filter bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search player name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showFilters || activeFilters > 0 ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/6 border-white/10 text-zinc-300 hover:bg-white/10'}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilters > 0 && (
              <span className="bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{activeFilters}</span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Tier filter */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Category</label>
              <div className="flex gap-1.5">
                {(['all', 'A', 'B'] as const).map((t) => (
                  <button key={t} onClick={() => setFilterTier(t)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${filterTier === t ? 'bg-blue-500/30 border-blue-500/50 text-blue-300 font-medium' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/8'}`}>
                    {t === 'all' ? 'All' : `Cat ${t}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Age bracket filter */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Age</label>
              <div className="flex gap-1.5">
                {[{ v: 'all', l: 'All' }, { v: 'under_35', l: 'U35' }, { v: 'above_35', l: '35+' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setFilterAge(v as typeof filterAge)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${filterAge === v ? 'bg-blue-500/30 border-blue-500/50 text-blue-300 font-medium' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/8'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="w-full text-xs py-1.5 px-2 rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">All</option>
                <option value="available">Available</option>
                <option value="sold">Sold</option>
                <option value="unsold">Unsold</option>
              </select>
            </div>

            {/* Role filter */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Role</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full text-xs py-1.5 px-2 rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">All Roles</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-zinc-500">
            Showing <span className="text-white font-medium">{filtered.length}</span> of {players.length} players
          </p>
          {(activeFilters > 0 || search) && (
            <button
              onClick={() => { setSearch(''); setFilterTier('all'); setFilterAge('all'); setFilterRole('all'); setFilterStatus('all'); }}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        {/* Player grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-white/4 border border-white/6 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No players found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((player) => (
              <PlayerCard key={player.id} player={player} onClick={() => setSelectedPlayer(player)} />
            ))}
          </div>
        )}
      </main>

      {selectedPlayer && (
        <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}
