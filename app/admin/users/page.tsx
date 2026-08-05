'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Team, User } from '@/types';
import { Users, UserPlus, Trash2, Loader2, AlertCircle, Shield, CheckCircle, ArrowLeft, Database } from 'lucide-react';

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [teamId, setTeamId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch teams for dropdown
      const teamsSnap = await getDocs(query(collection(db, 'teams'), orderBy('name')));
      setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));

      // Fetch users via API
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (err) {
      console.error('Error fetching data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, teamId: teamId || null }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(`User ${username} created successfully!`);
        setUsername('');
        setPassword('');
        setTeamId('');
        fetchData(); // Refresh list
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (usernameToDelete: string) => {
    if (!window.confirm(`Are you sure you want to delete user: ${usernameToDelete}?`)) return;
    
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameToDelete }),
      });
      if (res.ok) {
        fetchData();
      } else {
        alert('Failed to delete user');
      }
    } catch (err) {
      alert('Error deleting user');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[oklch(0.12_0.01_250)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.12_0.01_250)] p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/directory"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Directory
            </a>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/admin/import"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 px-3 py-2 rounded-xl transition-all"
            >
              <Database className="w-3.5 h-3.5" /> Import Data
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">User Management</h1>
            <p className="text-xs text-zinc-400">Create credentials for team owners</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Create User Form */}
          <div className="md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-5 self-start">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <UserPlus className="w-4 h-4 text-blue-400" /> Add New Owner
            </h2>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Username</label>
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g. acci_owner"
                />
              </div>
              
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Password</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="Choose a password"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Assign Team (Optional)</label>
                <select 
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">-- No Team (Spectator) --</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 p-2 rounded">
                  <AlertCircle className="w-3.5 h-3.5" /> {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded">
                  <CheckCircle className="w-3.5 h-3.5" /> {success}
                </div>
              )}

              <button 
                type="submit" 
                disabled={creating}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>

          {/* User List */}
          <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Existing Users ({users.length})</h2>
            
            {users.length === 0 ? (
              <p className="text-sm text-zinc-500">No team owners created yet.</p>
            ) : (
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-white/4 rounded-xl hover:bg-white/10 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{u.username}</p>
                        {u.role === 'admin' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-semibold flex items-center gap-1">
                            <Shield className="w-3 h-3" /> ADMIN
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Team: {u.teamId ? teams.find(t => t.id === u.teamId)?.name || u.teamId : 'None'}
                      </p>
                    </div>
                    
                    {u.role !== 'admin' && (
                      <button 
                        onClick={() => handleDelete(u.username)}
                        className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
