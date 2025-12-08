import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { FC, useCallback, useMemo, useState } from 'react';
import { notify } from "../utils/notifications";
import useUserSOLBalanceStore from '../stores/useUserSOLBalanceStore';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { generateSigner, transactionBuilder, publicKey, some, UnexpectedAccountError } from '@metaplex-foundation/umi';
import { fetchCandyMachine, mintV2, mplCandyMachine, safeFetchCandyGuard } from "@metaplex-foundation/mpl-candy-machine";
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { Metaplex } from "@metaplex-foundation/js";
import { PublicKey, clusterApiUrl } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { DeserializingEmptyBufferError } from '@metaplex-foundation/umi/serializers';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';


// These access the environment variables we defined in the .env file
const quicknodeEndpoint = process.env.NEXT_PUBLIC_RPC || clusterApiUrl('devnet');
const candyMachineAddress = publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
const treasury = publicKey(process.env.NEXT_PUBLIC_TREASURY);

export const CandyMint: FC = () => {
    const [mintAddress, setMintAddress] = useState('');
    const [metadata, setMetadata] = useState('');
    const [isMinting, setIsMinting] = useState(false);
    const [recentMints, setRecentMints] = useState<string[]>([]);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const { connection } = useConnection();
    const wallet = useWallet();
    const { getUserSOLBalance } = useUserSOLBalanceStore();
    const [mintCount, setMintCount] = useState(1);
    const metaplex = useMemo(() => new Metaplex(connection), [connection]);

    //Stockage du NFT minté dans Firestore
    const saveNftDocument = async (mintAddress, metadata, owner) => {
        try {
            const response = await fetch('/api/nft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mintAddress, metadata, owner }),
            });

            const data = await response.json();
            if (response.ok) {
                alert(`NFT ajouté avec succès avec l'ID : ${data.id}`);
                setMintAddress('');
                setMetadata('');
            } else {
                alert(`Erreur : ${data.error}`);
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout du NFT:', error);
            alert('Erreur lors de l\'ajout du NFT');
        }
    };

    const umi = useMemo(() =>
        createUmi(quicknodeEndpoint)
            .use(walletAdapterIdentity(wallet))
            .use(mplCandyMachine())
            .use(mplTokenMetadata()),
        [wallet, quicknodeEndpoint]
    );

    const onClick = useCallback(async () => {
        console.log('Wallet : ', wallet.publicKey);
        if (!wallet.publicKey) {
            console.log('error', 'Wallet not connected!');
            notify({ type: 'error', message: 'error', description: 'Wallet not connected!' });
            return;
        }

       // Fetch the Candy Machine.
const candyMachine = await fetchCandyMachine(umi, candyMachineAddress);

// Try to fetch the Candy Guard, handle if it's invalid or doesn't exist.
let hasCandyGuard = false;
try {
    await safeFetchCandyGuard(umi, candyMachine.mintAuthority);
    hasCandyGuard = true;
} catch (error) {
    if (error instanceof UnexpectedAccountError || error instanceof DeserializingEmptyBufferError) {
        console.warn("Pas de CandyGuard attaché à ce Candy Machine (mintAuthority =", candyMachine.mintAuthority.toString(), ")");
    } else {
        console.error("Erreur inconnue lors de la récupération du CandyGuard:", error);
    }
    // Pas de throw: on continue sans CandyGuard.
}

        try {
            const MAX_PER_TX = 1; // limiter pour ne pas dépasser la taille de transaction
            const mintedAll: string[] = [];
            const batches = Math.ceil(mintCount / MAX_PER_TX);

            setIsMinting(true);
            setStatusMessage('Signature en cours...');

            for (let batch = 0; batch < batches; batch++) {
                const start = batch * MAX_PER_TX;
                const end = Math.min(start + MAX_PER_TX, mintCount);
                const mints = [];

                let tx = transactionBuilder().add(setComputeUnitLimit(umi, { units: 1_400_000 }));
                for (let i = start; i < end; i++) {
                    const nftMint = generateSigner(umi);
                    mints.push(nftMint);
                    tx = tx.add(
                        mintV2(umi, {
                            candyMachine: candyMachine.publicKey,
                            candyGuard: hasCandyGuard ? candyMachine.mintAuthority : undefined,
                            nftMint,
                            collectionMint: candyMachine.collectionMint,
                            collectionUpdateAuthority: candyMachine.authority,
                            mintArgs: hasCandyGuard
                                ? {
                                    solPayment: some({ destination: treasury }),
                                  }
                                : {},
                        }),
                    );
                }

                const { signature } = await tx.sendAndConfirm(umi, {
                    confirm: { commitment: "confirmed" },
                });
                const txid = bs58.encode(signature);
                console.log('success', `Mint batch successful! ${txid}`);
                setStatusMessage(`Transaction confirmée: ${txid.slice(0, 12)}...`);

                for (const nftMint of mints) {
                    mintedAll.push(nftMint.publicKey.toString());
                    console.log(`Mint address NFT: ${nftMint.publicKey.toString()}`);
                    const metadata = await (await metaplex.nfts().findByMint({mintAddress: new PublicKey(nftMint.publicKey)})).json;
                    console.log(`metadata: ${metadata.name}`);
                    console.log("owner", wallet.publicKey.toString());

                    const imageUrl = metadata.image;
                    const name = metadata.name;
                    const description = metadata.description;
                    const attributes = metadata.attributes;

                    const metadataToStore = {
                        mintAddress: nftMint.publicKey.toString(),
                        imageUrl,
                        name,
                        description,
                        attributes
                    };

                    await setMintAddress(nftMint.publicKey.toString());
                    saveNftDocument(nftMint.publicKey.toString(), metadataToStore, wallet.publicKey.toString());
                    setRecentMints(prev => [nftMint.publicKey.toString(), ...prev].slice(0, 4));
                }
            }

            notify({ type: 'success', message: 'Mint successful!' });
            getUserSOLBalance(wallet.publicKey, connection);
        } catch (error: any) {
            notify({ type: 'error', message: `Error minting!`, description: error?.message });
            console.log('error', `Mint failed! ${error?.message}`);
            setStatusMessage(error?.message ?? 'Mint échoué');
        }
        setIsMinting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wallet, connection, getUserSOLBalance, umi, candyMachineAddress, treasury, mintCount]);

return (
  <div className="relative w-full max-w-6xl mx-auto px-6 py-6">
    <div className="absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(236,72,153,0.16),transparent_40%),radial-gradient(circle_at_60%_80%,rgba(56,189,248,0.18),transparent_45%)] blur-2xl opacity-80" />
    <div className="relative rounded-[28px] border border-white/10 bg-slate-900/70 backdrop-blur-2xl shadow-2xl overflow-hidden min-h-[520px]">
      <div className="px-6 sm:px-10 py-8 flex flex-col gap-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-400">Mint en direct</p>
            <h1 className="text-3xl sm:text-4xl font-semibold mt-2">Collection Solana</h1>
            <p className="text-sm text-slate-300 mt-3 max-w-xl">
              Connectez votre wallet, choisissez combien de NFTs minter, puis lancez la frappe.
              Les transactions sont signées depuis votre portefeuille.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Devnet
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <WalletMultiButton className="!w-full !bg-gradient-to-r !from-indigo-500 !via-fuchsia-500 !to-amber-400 !text-white !rounded-2xl !px-5 !py-4 !font-semibold !shadow-lg hover:!opacity-90 transition" />

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Nombre de NFTs</span>
                <span className="text-xs uppercase tracking-wide text-slate-400">max 1/tx</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 rounded-2xl border border-white/10 px-4 py-3">
                <input
                  type="number"
                  value={mintCount}
                  onChange={(e) => setMintCount(Math.max(1, Number(e.target.value)))}
                  min="1"
                  className="w-full bg-transparent outline-none text-lg font-semibold"
                  placeholder="1"
                />
                <div className="text-xs text-slate-400">NFTs</div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={onClick}
                disabled={isMinting}
                className="w-full py-4 text-white font-semibold bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 rounded-2xl shadow-xl hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isMinting ? 'Mint en cours...' : '🚀 Minter maintenant'}
              </button>
              {statusMessage && (
                <div className="text-sm text-slate-200 bg-white/10 border border-white/10 rounded-xl px-4 py-3">
                  {statusMessage}
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              Astuce : le batch est limité à 1/transaction pour éviter les transactions trop lourdes.
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Détails réseau</h2>
                <span className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Live
                </span>
              </div>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>RPC</span>
                  <span className="font-mono text-slate-200 truncate max-w-[160px] text-right">
                    {quicknodeEndpoint}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Candy Machine</span>
                  <span className="font-mono text-slate-200 truncate max-w-[160px] text-right">
                    {process.env.NEXT_PUBLIC_CANDY_MACHINE_ID}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Derniers mints</h2>
                <span className="text-xs text-slate-400">{recentMints.length || '0'}</span>
              </div>
              {recentMints.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun mint encore — soyez le premier.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {recentMints.map((mint) => (
                    <li
                      key={mint}
                      className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/5"
                    >
                      <span className="font-mono text-slate-200 truncate max-w-[180px]">{mint}</span>
                      <a
                        href={`https://explorer.solana.com/address/${mint}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-amber-200 hover:text-amber-100"
                      >
                        Explorer ↗
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

}
