import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTransactionByHash } from '../services/api';
import {
  ArrowLeft,
  Box,
  Clock,
  Shield,
  CheckCircle2,
  Copy
} from 'lucide-react';

export const TransactionDetail = () => {
  const { hash } = useParams<{ hash: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['transaction', hash],
    queryFn: () => getTransactionByHash(hash!),
    enabled: !!hash
  });

  // Cast data to any to access properties
  const tx = (data as any)?.data;

  const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    return (
      <button
        onClick={() => {
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="p-1 hover:text-white text-slate-500 transition-colors"
      >
        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
      </button>
    );
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );

  if (error || !tx) return (
    <div className="text-center py-20">
      <h3 className="text-xl font-bold text-white mb-2">Transaction Not Found</h3>
      <p className="text-slate-400 mb-6">The transaction hash could not be found in the index.</p>
      <Link to="/explorer" className="text-indigo-400 hover:text-indigo-300">Back to Explorer</Link>
    </div>
  );

  const proofData = typeof tx.proofData === 'string' ? JSON.parse(tx.proofData) : tx.proofData;

  return (
    <div className="space-y-6">
      <Link to="/explorer" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Explorer
      </Link>

      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/60 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
              Transaction Details
              {tx.shieldedOutputs > 0 && (
                <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Shielded
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 font-mono text-slate-400 text-sm break-all">
              {tx.txHash}
              <CopyButton text={tx.txHash} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400 mb-1">Mined At</div>
            <div className="flex items-center justify-end gap-2 text-white">
              <Clock className="w-4 h-4 text-slate-500" />
              {new Date(tx.timestamp).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Block Info</h3>
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400">Height</span>
                  <div className="flex items-center gap-2 text-indigo-400 font-mono font-medium">
                    <Box className="w-4 h-4" />
                    {tx.blockHeight}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Confirmations</span>
                  <span className="text-white">12,402</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Shielded Data</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 text-center">
                  <div className="text-slate-400 text-xs uppercase mb-1">Inputs</div>
                  <div className="text-2xl font-bold text-white">{tx.shieldedInputs}</div>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 text-center">
                  <div className="text-slate-400 text-xs uppercase mb-1">Outputs</div>
                  <div className="text-2xl font-bold text-emerald-400">{tx.shieldedOutputs}</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Halo 2 Proofs</h3>
            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-700/30 font-mono text-xs text-slate-300 h-[300px] overflow-y-auto">
              {proofData ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-indigo-400">proofType:</span> "{proofData.proofType}"
                  </div>
                  {proofData.spendProofs && proofData.spendProofs.length > 0 && (
                     <div>
                       <span className="text-slate-500">// Spend Proofs ({proofData.spendProofs.length})</span>
                       {proofData.spendProofs.map((p: any, i: number) => (
                         <div key={i} className="pl-4 border-l border-slate-800 mt-2">
                           <div className="truncate"><span className="text-amber-500">nullifier:</span> {p.nullifier}</div>
                           <div className="truncate"><span className="text-amber-500">anchor:</span> {p.anchor}</div>
                         </div>
                       ))}
                     </div>
                  )}
                  {proofData.outputProofs && proofData.outputProofs.length > 0 && (
                     <div className="mt-4">
                       <span className="text-slate-500">// Output Proofs ({proofData.outputProofs.length})</span>
                       {proofData.outputProofs.map((p: any, i: number) => (
                         <div key={i} className="pl-4 border-l border-slate-800 mt-2">
                           <div className="truncate"><span className="text-emerald-500">cv:</span> {p.cv}</div>
                           <div className="truncate"><span className="text-emerald-500">cmu:</span> {p.cmu}</div>
                         </div>
                       ))}
                     </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-600 italic">
                  No proof data available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
