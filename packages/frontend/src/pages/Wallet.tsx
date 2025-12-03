import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWalletTransactions } from '../services/api';
import {
  Shield,
  Lock,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Wallet as WalletIcon,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Wallet = () => {
  const [viewingKey, setViewingKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const { data: walletData, isLoading } = useQuery({
    queryKey: ['wallet', activeKey],
    queryFn: () => getWalletTransactions(activeKey!),
    enabled: !!activeKey,
    refetchInterval: 10000
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingKey) return;
    setActiveKey(viewingKey);
  };

  const data = (walletData as any)?.data;

  // Use isLoading from react-query to indicate submission/processing status
  const isSubmitting = isLoading && !!activeKey;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-4 rounded-full bg-indigo-500/10 mb-4 ring-1 ring-indigo-500/30">
          <Shield className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Shielded Wallet Access</h2>
        <p className="text-slate-400 max-w-lg mx-auto">
          Securely view your private transaction history using your Viewing Key.
          Keys are encrypted and processed in a confidential compute environment.
        </p>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/60 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-indigo-950/50 border border-indigo-500/20 rounded-full">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-indigo-300">Nillion Secure Enclave</span>
        </div>

        {!activeKey && !isSubmitting ? (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">
                Enter Unified or Sapling Viewing Key
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input
                  type={showKey ? "text" : "password"}
                  value={viewingKey}
                  onChange={(e) => setViewingKey(e.target.value)}
                  className="block w-full pl-12 pr-12 py-4 bg-slate-950/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all font-mono text-sm"
                  placeholder="zxvk..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
                >
                  {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200/80">
                <p className="font-medium text-amber-200 mb-1">Privacy Notice</p>
                Your viewing key is never stored in plain text. It is encrypted using Nillion's privacy-preserving infrastructure before being used to query the blockchain.
              </div>
            </div>

            <button
              type="submit"
              disabled={!viewingKey}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 flex items-center justify-center gap-2"
            >
              <Lock className="w-5 h-5" />
              Decrypt Private History
            </button>
          </form>
        ) : isSubmitting ? (
             <div className="max-w-xl mx-auto mt-12 mb-12 text-center">
                 <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                 <h3 className="text-xl font-bold text-white mb-2">Processing Securely</h3>
                 <p className="text-slate-400">Encrypting key via Nillion and scanning Zcash blockchain...</p>
             </div>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <WalletIcon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Shielded Account</h3>
                    <p className="text-sm text-slate-400 font-mono">
                      {activeKey?.substring(0, 16)}...{activeKey?.substring(activeKey.length - 8)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveKey(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                  <p className="text-sm text-slate-400 mb-1">Total Transactions</p>
                  <p className="text-2xl font-bold text-white">{data?.stats?.totalTransactions || 0}</p>
                </div>
                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                  <p className="text-sm text-slate-400 mb-1">Incoming Inputs</p>
                  <p className="text-2xl font-bold text-emerald-400">{data?.stats?.totalShieldedInputs || 0}</p>
                </div>
                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                  <p className="text-sm text-slate-400 mb-1">Outgoing Outputs</p>
                  <p className="text-2xl font-bold text-indigo-400">{data?.stats?.totalShieldedOutputs || 0}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-md font-medium text-white">Transaction History</h4>
                {data?.transactions?.length > 0 ? (
                  data.transactions.map((tx: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tx.shieldedInputs > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {tx.shieldedInputs > 0 ? <ArrowRight className="w-4 h-4 rotate-45" /> : <ArrowRight className="w-4 h-4 -rotate-45" />}
                        </div>
                        <div>
                          <p className="font-mono text-sm text-slate-300">{tx.txHash.substring(0, 24)}...</p>
                          <p className="text-xs text-slate-500">{new Date(tx.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                      {tx.memoData && (
                        <div className="px-3 py-1 bg-slate-800 rounded text-xs text-slate-400 border border-slate-700">
                          Memo
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-slate-800/20 rounded-xl border border-slate-800 border-dashed">
                    <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
                    <p className="text-slate-400">No transactions found or scanning in progress.</p>
                    <p className="text-xs text-slate-500 mt-1">Large wallets may take some time to decrypt.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
