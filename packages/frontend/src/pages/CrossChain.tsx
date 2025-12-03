import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createIntent } from '../services/api';
import {
  ArrowRightLeft,
  ShieldCheck,
  Globe,
  Zap,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';

export const CrossChain = () => {
  const [amount, setAmount] = useState('');
  const [nearAccount, setNearAccount] = useState('');
  const [step, setStep] = useState(0); // 0: Input, 1: Signing, 2: Success

  const mutation = useMutation({
    mutationFn: createIntent,
    onSuccess: () => setStep(2)
  });

  const handleBridge = () => {
    if (!amount || !nearAccount) return;
    setStep(1);
    mutation.mutate({ amount, nearAccount });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-4 rounded-full bg-indigo-500/10 mb-4 ring-1 ring-indigo-500/30">
          <ArrowRightLeft className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Cross-Chain Privacy Bridge</h2>
        <p className="text-slate-400 max-w-lg mx-auto">
          Leverage NEAR Chain Signatures to manage your Zcash assets from any chain.
          Intent-based execution preserves your privacy while enabling DeFi interoperability.
        </p>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/60 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Source Asset</p>
                <p className="font-bold text-white">Shielded ZEC</p>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="p-2 bg-slate-800/50 rounded-full border border-slate-700">
                <ArrowRight className="w-4 h-4 text-slate-500 rotate-90 md:rotate-0" />
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <div className="p-3 bg-indigo-500/10 rounded-lg">
                <Globe className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Destination</p>
                <p className="font-bold text-white">NEAR Protocol</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800/50">
               <div>
                 <label className="text-sm font-medium text-slate-300 mb-2 block">Amount to Bridge (ZEC)</label>
                 <input
                   type="number"
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                   placeholder="0.00"
                   disabled={step > 0}
                 />
               </div>
               <div>
                 <label className="text-sm font-medium text-slate-300 mb-2 block">NEAR Account ID</label>
                 <input
                   type="text"
                   value={nearAccount}
                   onChange={(e) => setNearAccount(e.target.value)}
                   className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                   placeholder="user.near"
                   disabled={step > 0}
                 />
               </div>
            </div>

            <button
              onClick={handleBridge}
              disabled={!amount || !nearAccount || step > 0}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {step === 0 && (
                <>
                  <Zap className="w-5 h-5" />
                  Initiate Chain Signature
                </>
              )}
              {step === 1 && (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                  Signing on MPC Node...
                </>
              )}
              {step === 2 && (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Intent Signed & Broadcast
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-950/30 rounded-2xl p-6 border border-slate-800/50 h-full">
             <h3 className="text-lg font-semibold text-white mb-4">How it works</h3>
             <ul className="space-y-4">
               {[
                 { title: 'Intent Creation', desc: 'You define an intent to move assets. No private keys ever leave your device.' },
                 { title: 'MPC Signing', desc: 'NEAR MPC nodes decentralizedly sign the Zcash transaction.' },
                 { title: 'Privacy Preserved', desc: 'The transaction on Zcash appears as a standard shielded transfer.' }
               ].map((item, i) => (
                 <li key={i} className="flex gap-4">
                   <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-400 border border-slate-700">
                     {i + 1}
                   </div>
                   <div>
                     <p className="text-white font-medium text-sm">{item.title}</p>
                     <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
                   </div>
                 </li>
               ))}
             </ul>

             {step === 2 && (
               <motion.div
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
               >
                 <p className="text-emerald-400 text-sm font-medium flex items-center gap-2 mb-2">
                   <ShieldCheck className="w-4 h-4" />
                   Success!
                 </p>
                 <p className="text-slate-400 text-xs mb-2">Transaction Hash:</p>
                 <p className="font-mono text-xs text-white break-all bg-slate-950/50 p-2 rounded border border-slate-800">
                   {(mutation.data as any)?.txHash || 'Pending Confirmation'}
                 </p>
               </motion.div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
