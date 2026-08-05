'use client';
import { useEffect, useState } from 'react';
import { Team, User } from '@/types';
import {
  Users, UserPlus, Trash2, Loader2, AlertCircle, Shield,
  CheckCircle, ArrowLeft, Database, KeyRound, X, Eye, EyeOff, Edit
} from 'lucide-react';

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [teamId, setTeamId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset password modal state
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // Edit team modal state
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editTeamId, setEditTeamId] = useState<string>('');
  const [updatingTeam, setUpdatingTeam] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch teams via server route to bypass Firestore client SDK rules
      const teamsRes = await fetch('/api/teams');
      const teamsData = await teamsRes.json();
      if (teamsData.success) {
        setTeams(teamsData.teams);
      }

      // Fetch users
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (err) {
      console.error('Error fetching data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

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
        setUsername(''); setPassword(''); setTeamId('');
        fetchData();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch { setError('Network error'); }
    finally { setCreating(false); }
  };

  const handleDelete = async (usernameToDelete: string) => {
    if (!window.confirm(`Delete user: ${usernameToDelete}?`)) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameToDelete }),
      });
      if (res.ok) fetchData();
      else alert('Failed to delete user');
    } catch { alert('Error deleting user'); }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !resetPassword) return;
    setResetting(true);
    setResetError('');
    setResetSuccess('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetTarget.username, newPassword: resetPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetSuccess(`Password for "${resetTarget.username}" has been reset.`);
        setResetPassword('');
      } else {
        setResetError(data.error || 'Failed to reset password');
      }
    } catch { setResetError('Network error'); }
    finally { setResetting(false); }
  };

  const handleUpdateTeam = async () => {
    if (!editTarget) return;
    setUpdatingTeam(true);
    setEditError('');
    setEditSuccess('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: editTarget.username, teamId: editTeamId || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditSuccess(`Team for "${editTarget.username}" updated!`);
        fetchData();
      } else {
        setEditError(data.error || 'Failed to update team');
      }
    } catch { setEditError('Network error'); }
    finally { setUpdatingTeam(false); }
  };

  const closeResetModal = () => {
    setResetTarget(null);
    setResetPassword('');
    setResetError('');
    setResetSuccess('');
    setShowResetPw(false);
  };

  const openEditModal = (user: User) => {
    setEditTarget(user);
    setEditTeamId(user.teamId || '');
    setEditError('');
    setEditSuccess('');
  };

  const closeEditModal = () => {
    setEditTarget(null);
    setEditTeamId('');
    setEditError('');
    setEditSuccess('');
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

        {/* Nav row */}
        <div className="flex items-center justify-between">
          <a
            href="/directory"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Directory
          </a>
          <a
            href="/admin/import"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 px-3 py-2 rounded-xl transition-all"
          >
            <Database className="w-3.5 h-3.5" /> Import Data
          </a>
        </div>

        {/* Page title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">User Management</h1>
            <p className="text-xs text-zinc-400">Create credentials, edit teams, and reset passwords for team owners</p>
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
                  type="text" required value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g. acci_owner"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Password</label>
                <input
                  type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="Choose a password"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Assign Team (Optional)</label>
                <select
                  value={teamId} onChange={(e) => setTeamId(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">-- No Team (Spectator) --</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                type="submit" disabled={creating}
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
                  <div key={u.id} className="flex items-center justify-between p-3 bg-white/4 rounded-xl hover:bg-white/6 transition-colors">
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
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(u)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit Team Assignment"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit Team</span>
                        </button>
                        <button
                          onClick={() => setResetTarget(u)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Reset PW</span>
                        </button>
                        <button
                          onClick={() => handleDelete(u.username)}
                          className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Team Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[oklch(0.16_0.01_250)] border border-white/12 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white">Assign / Edit Team</h3>
                <p className="text-xs text-zinc-400 mt-0.5">For user: <span className="text-white font-mono">{editTarget.username}</span></p>
              </div>
              <button onClick={closeEditModal} className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Select Team</label>
                <select
                  value={editTeamId}
                  onChange={(e) => setEditTeamId(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
                >
                  <option value="">-- No Team (Spectator) --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {editError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {editError}
                </div>
              )}
              {editSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> {editSuccess}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={closeEditModal}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:bg-white/8 text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateTeam}
                  disabled={updatingTeam}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  {updatingTeam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />}
                  {updatingTeam ? 'Saving…' : 'Save Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[oklch(0.16_0.01_250)] border border-white/12 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white">Reset Password</h3>
                <p className="text-xs text-zinc-400 mt-0.5">For user: <span className="text-white font-mono">{resetTarget.username}</span></p>
              </div>
              <button onClick={closeResetModal} className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showResetPw ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPw(!showResetPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {resetError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {resetError}
                </div>
              )}
              {resetSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> {resetSuccess}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={closeResetModal}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:bg-white/8 text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resetting || resetPassword.length < 6}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {resetting ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
