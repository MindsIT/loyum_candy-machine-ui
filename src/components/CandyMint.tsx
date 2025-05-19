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
let candyGuard;
try {
    candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);
} catch (error) {
    if (error instanceof UnexpectedAccountError) {
        console.error("L'adresse fournie n'est pas un CandyGuard valide:", candyMachine.mintAuthority.toString());
    } else if (error instanceof DeserializingEmptyBufferError) {
        console.error("Le compte est vide ou non initialisé:", candyMachine.mintAuthority.toString());
    } else {
        console.error("Erreur inconnue lors de la récupération du CandyGuard:", error);
    }
    throw error; // Re-throw l'erreur pour arrêter le processus si CandyGuard n'est pas valide.
}

        try {
            for (let i = 0; i < mintCount; i++) {
                const nftMint = generateSigner(umi);
                const transaction = await transactionBuilder()
                    .add(setComputeUnitLimit(umi, { units: 800_000 }))
                    .add(
                        mintV2(umi, {
                            candyMachine: candyMachine.publicKey,
                            candyGuard: candyMachine.mintAuthority,
                            nftMint,
                            collectionMint: candyMachine.collectionMint,
                            collectionUpdateAuthority: candyMachine.authority,
                            mintArgs: {
                                solPayment: some({ destination: treasury }),
                            },
                        })
                    );
                const { signature } = await transaction.sendAndConfirm(umi, {
                    confirm: { commitment: "confirmed" },
                });
                const txid = bs58.encode(signature);
                console.log('success', `Mint successful! ${txid}`);
                console.log(`Mint address NFT: ${nftMint.publicKey.toString()}`);

                // Fetch the metadata using the mint address
                let metadata = await (await metaplex.nfts().findByMint({mintAddress: new PublicKey(nftMint.publicKey)})).json;

               // const metadata = nft.json;
                console.log(`metadata: ${metadata.name}`);
                console.log("owner", wallet.publicKey.toString());

                const imageUrl = metadata.image;
                const name = metadata.name;
                const description = metadata.description;
                const attributes = metadata.attributes;

                // Prepare metadata object to store
                const metadataToStore = {
                    mintAddress: nftMint.publicKey.toString(),
                    imageUrl,
                    name,
                    description,
                    attributes
                };

                await setMintAddress(nftMint.publicKey.toString());
                saveNftDocument(nftMint.publicKey.toString(), metadataToStore, wallet.publicKey.toString());
            }

            notify({ type: 'success', message: 'Mint successful!' });
            getUserSOLBalance(wallet.publicKey, connection);
        } catch (error: any) {
            notify({ type: 'error', message: `Error minting!`, description: error?.message });
            console.log('error', `Mint failed! ${error?.message}`);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wallet, connection, getUserSOLBalance, umi, candyMachineAddress, treasury, mintCount]);

return (
  <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex flex-col items-center justify-center px-4">
    <div className="max-w-md w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-lg space-y-6 text-center">
      
      {/* Titre */}
      <h1 className="text-white text-2xl font-bold">
        🎨 Minter vos NFTs Solana
      </h1>

      {/* Bouton Wallet */}
      <div className="flex justify-center">
        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 text-white rounded-xl px-6 py-2 shadow-md transition duration-300" />
      </div>

      {/* Sélection nombre */}
      <input
        type="number"
        value={mintCount}
        onChange={(e) => setMintCount(Number(e.target.value))}
        min="1"
        className="w-full px-4 py-2 bg-white text-black rounded-md shadow-inner focus:outline-none focus:ring-2 focus:ring-purple-500"
        placeholder="Nombre de NFTs"
      />

      {/* Bouton Mint */}
      <button
        onClick={onClick}
        className="w-full py-3 text-white font-medium bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500 rounded-lg shadow-lg hover:opacity-90 transition"
      >
        🎉 Minter mes NFTs
      </button>
    </div>
  </div>
);

}