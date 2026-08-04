'use client';
import { RuleViolation } from '@/types';
import { AlertTriangle, XCircle } from 'lucide-react';

interface Props {
  violations: RuleViolation[];
}

export default function RuleAlert({ violations }: Props) {
  if (!violations.length) return null;

  return (
    <div className="space-y-2">
      {violations.map((v, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-xl p-3 text-sm border ${
            v.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {v.type === 'error' ? (
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{v.message}</span>
        </div>
      ))}
    </div>
  );
}
