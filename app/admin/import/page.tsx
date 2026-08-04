'use client';
import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Database, Loader2 } from 'lucide-react';

export default function ImportPage() {
  const [playersFile, setPlayersFile] = useState<File | null>(null);
  const [teamsFile, setTeamsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ playersImported?: number; teamsImported?: number; errors?: string[]; error?: string } | null>(null);

  const handleImport = async () => {
    if (!playersFile && !teamsFile) { alert('Select at least one file'); return; }
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    if (playersFile) formData.append('playersFile', playersFile);
    if (teamsFile) formData.append('teamsFile', teamsFile);

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[oklch(0.12_0.01_250)] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Import Data</h1>
            <p className="text-xs text-zinc-500">Seed Firestore from your Excel files</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Players file */}
          <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
            <label className="block text-sm font-medium text-zinc-300 mb-3">Players Excel (sarda.xlsx)</label>
            <label className="flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed border-white/10 rounded-xl p-6 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
              <Upload className={`w-6 h-6 ${playersFile ? 'text-emerald-400' : 'text-zinc-600'}`} />
              <span className="text-sm text-zinc-400">{playersFile ? playersFile.name : 'Click to select file'}</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setPlayersFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {/* Teams file */}
          <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
            <label className="block text-sm font-medium text-zinc-300 mb-3">Teams Excel (SSCL 6 Registrations...)</label>
            <label className="flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed border-white/10 rounded-xl p-6 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
              <Upload className={`w-6 h-6 ${teamsFile ? 'text-emerald-400' : 'text-zinc-600'}`} />
              <span className="text-sm text-zinc-400">{teamsFile ? teamsFile.name : 'Click to select file'}</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setTeamsFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <button
            onClick={handleImport}
            disabled={loading || (!playersFile && !teamsFile)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {loading ? 'Importing…' : 'Start Import'}
          </button>

          {/* Result */}
          {result && (
            <div className={`rounded-2xl p-4 border ${result.error ? 'bg-rose-500/10 border-rose-500/25' : 'bg-emerald-500/10 border-emerald-500/25'}`}>
              {result.error ? (
                <div className="flex items-center gap-2 text-rose-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{result.error}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle className="w-5 h-5" />
                    <p className="text-sm font-semibold">Import complete!</p>
                  </div>
                  {result.playersImported !== undefined && (
                    <p className="text-sm text-zinc-300">✅ {result.playersImported} players imported</p>
                  )}
                  {result.teamsImported !== undefined && (
                    <p className="text-sm text-zinc-300">✅ {result.teamsImported} teams imported</p>
                  )}
                  {result.errors && result.errors.length > 0 && (
                    <div>
                      <p className="text-xs text-amber-400 font-medium mb-1">{result.errors.length} warnings:</p>
                      {result.errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-xs text-zinc-500">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <a href="/directory" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            → Go to Player Directory
          </a>
        </div>
      </div>
    </div>
  );
}
