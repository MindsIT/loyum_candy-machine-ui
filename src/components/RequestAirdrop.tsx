import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, TransactionSignature } from '@solana/web3.js';
import { FC, useCallback } from 'react';
import { notify } from "../utils/notifications";
import useUserSOLBalanceStore from '../stores/useUserSOLBalanceStore';

export const RequestAirdrop: FC = () => {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const { getUserSOLBalance } = useUserSOLBalanceStore();

    const onClick = useCallback(async () => {
        if (!publicKey) {
            console.log('error', 'Wallet not connected!');
            notify({ type: 'error', message: 'error', description: 'Wallet not connected!' });
            return;
        }

        let signature: TransactionSignature = '';

        try {
            signature = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);

            // Get the lates block hash to use on our transaction and confirmation
            let latestBlockhash = await connection.getLatestBlockhash()
            await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed');

            notify({ type: 'success', message: 'Airdrop successful!', txid: signature });

            getUserSOLBalance(publicKey, connection);
        } catch (error: any) {
            notify({ type: 'error', message: `Airdrop failed!`, description: error?.message, txid: signature });
            console.log('error', `Airdrop failed! ${error?.message}`, signature);
        }
    }, [publicKey, connection, getUserSOLBalance]);

    return (
        <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl px-4 py-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="text-sm font-semibold text-white">Airdrop 1 SOL</p>
                    <p className="text-xs text-slate-400">Devnet uniquement</p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                    Beta
                </span>
            </div>
            <button
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 text-white font-semibold shadow-lg hover:opacity-90 transition"
                onClick={onClick}
            >
                Demander 1 SOL
            </button>
        </div>
    );
};
