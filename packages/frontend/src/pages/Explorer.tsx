import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '../services/api';
import {
  Search,
  Shield,
  Unlock,
  ArrowRight,
  Clock,
  Box,
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../utils/cn';
import { Link } from 'react-router-dom';

export const Explorer = () => {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, filter],
    queryFn: () => getTransactions({
      offset: page * 20,
      limit: 20,
      minShieldedInputs: filter === 'shielded' ? 1 : undefined,
      minShieldedOutputs: filter === 'shielded' ? 1 : undefined
    }),
    refetchInterval: 10000
  });

  const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
      e.preventDefault();
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <button onClick={handleCopy} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white">
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    );
  };

  const txData = data as any; // Cast to avoid TS errors for now

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/50 backdrop-blur-sm border border-slate-800/60 p-4 rounded-2xl">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Transaction Hash..."
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              filter === 'all' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('shielded')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              filter === 'shielded' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
            )}
          >
            <Shield className="w-3.5 h-3.5" />
            Shielded
          </button>
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/60 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/60 bg-slate-900/50">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Transaction Hash</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Block</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Age</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Shielded Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-12 ml-auto"></div></td>
                  </tr>
                ))
              ) : (
                txData?.transactions?.map((tx: any) => (
                  <tr key={tx.id} className="group hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link to={`/tx/${tx.txHash}`} className="font-mono text-indigo-400 hover:text-indigo-300 transition-colors">
                          {tx.txHash.substring(0, 16)}...
                        </Link>
                        <CopyButton text={tx.txHash} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Box className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-mono">{tx.blockHeight}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {tx.shieldedOutputs > 0 ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                          <Shield className="w-3 h-3" />
                          Shielded
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
                          <Unlock className="w-3 h-3" />
                          Transparent
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(tx.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3 text-sm">
                        <span className="text-slate-400">{tx.shieldedInputs} In</span>
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                        <span className="text-white font-medium">{tx.shieldedOutputs} Out</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-800/60 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing <span className="text-white font-medium">{page * 20 + 1}</span> to <span className="text-white font-medium">{Math.min((page + 1) * 20, txData?.pagination?.total || 0)}</span> of <span className="text-white font-medium">{txData?.pagination?.total || 0}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={!txData?.pagination?.hasMore}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
