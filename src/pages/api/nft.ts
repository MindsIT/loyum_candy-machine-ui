import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

type NftBody = {
  mintAddress: string;
  metadata: unknown;
  owner: string;
};

let firebaseApp: admin.app.App | null = null;
let firebaseInitError: Error | null = null;

const initFirebaseAdmin = () => {
  if (firebaseApp || firebaseInitError) return;

  try {
    if (admin.apps.length) {
      firebaseApp = admin.app();
      return;
    }

    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountEnv) {
      const serviceAccount = JSON.parse(serviceAccountEnv);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
      return;
    }

    const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
    if (serviceAccountB64) {
      const decoded = Buffer.from(serviceAccountB64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
      return;
    }

    const serviceAccountPathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
    if (serviceAccountPathEnv) {
      const resolvedPath = path.isAbsolute(serviceAccountPathEnv)
        ? serviceAccountPathEnv
        : path.join(process.cwd(), serviceAccountPathEnv);

      if (!fs.existsSync(resolvedPath)) {
        firebaseInitError = new Error(
          `Service account file not found at ${resolvedPath}.`
        );
        return;
      }

      const raw = fs.readFileSync(resolvedPath, 'utf8');
      const serviceAccount = JSON.parse(raw);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
      return;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      return;
    }

    firebaseInitError = new Error(
      'Firebase admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY (raw JSON), FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, FIREBASE_SERVICE_ACCOUNT_KEY_PATH, or GOOGLE_APPLICATION_CREDENTIALS.'
    );
    return;
  } catch (error) {
    firebaseInitError = error as Error;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  initFirebaseAdmin();

  if (firebaseInitError || !firebaseApp) {
    res
      .status(500)
      .json({
        error:
          firebaseInitError?.message ??
          "Impossible d'initialiser Firebase (configuration manquante).",
      });
    return;
  }

  const db = firebaseApp.firestore();

  const { mintAddress, metadata, owner } = req.body as NftBody;

  if (!mintAddress || !owner) {
    res.status(400).json({ error: 'mintAddress et owner sont requis' });
    return;
  }

  try {
    const docRef = await db.collection('NFTs').add({
      mintAddress,
      metadata,
      owner,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ message: 'NFT ajouté avec succès', id: docRef.id });
  } catch (error) {
    console.error("Erreur lors de l'ajout du NFT:", error);
    res.status(500).json({ error: "Erreur lors de l'ajout du NFT" });
  }
}
