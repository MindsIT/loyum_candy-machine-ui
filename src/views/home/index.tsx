// Next, React
import { FC, useEffect, useState } from 'react';
import Link from 'next/link';

// Wallet
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

// Components
import { RequestAirdrop } from '../../components/RequestAirdrop';
import { CandyMint } from '../../components/CandyMint';
import { TokenCreator } from '../../components/TokenCreator';



import pkg from '../../../package.json';

// Store
import useUserSOLBalanceStore from '../../stores/useUserSOLBalanceStore';

export const HomeView: FC = ({ }) => {
  const wallet = useWallet();
  const { connection } = useConnection();

  const balance = useUserSOLBalanceStore((s) => s.balance)
  const { getUserSOLBalance } = useUserSOLBalanceStore()

  useEffect(() => {
    if (wallet.publicKey) {
      console.log(wallet.publicKey.toBase58())
      getUserSOLBalance(wallet.publicKey, connection)
    }
  }, [wallet.publicKey, connection, getUserSOLBalance])

  return (

    <div className="space-y-10">
      <div className="max-w-6xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-fuchsia-900/20 backdrop-blur-2xl px-6 sm:px-10 py-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Solana Next</p>
            <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-amber-300">
              Mint NFT + Tokens SPL sur devnet
            </h1>
          </div>
          <div className="text-sm text-slate-400 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            v{pkg.version}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        <CandyMint />
        <TokenCreator />
        <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl px-4 py-4 text-sm text-slate-300 shadow-lg">
          Solde wallet {wallet?.publicKey ? (
            <span className="font-semibold text-slate-100 ml-2">
              {(balance || 0).toLocaleString()} SOL
            </span>
          ) : (
            <span className="ml-2 text-slate-400">Connectez votre wallet</span>
          )}
        </div>
        <RequestAirdrop />
      </div>
    </div>
  );
};
