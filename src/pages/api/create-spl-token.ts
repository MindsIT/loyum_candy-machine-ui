import type { NextApiRequest, NextApiResponse } from 'next';
import { PubSub } from '@google-cloud/pubsub';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

type Body = {
  initialSupply?: number;
  decimals?: number;
};

let pubsubClient: PubSub | null = null;
let pubsubInitError: Error | null = null;
let projectId: string | undefined;

function loadServiceAccount() {
  if (admin.apps.length) {
    return null;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    || (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
      ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8')
      : undefined);

  if (raw) {
    const json = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(json as admin.ServiceAccount) });
    return json;
  }

  const filePathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
  if (filePathEnv) {
    const resolved = path.isAbsolute(filePathEnv)
      ? filePathEnv
      : path.join(process.cwd(), filePathEnv);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Service account file not found at ${resolved}`);
    }
    const json = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(json as admin.ServiceAccount) });
    return json;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    return null;
  }

  throw new Error(
    'Firebase admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY (raw JSON), FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, FIREBASE_SERVICE_ACCOUNT_KEY_PATH, or GOOGLE_APPLICATION_CREDENTIALS.'
  );
}

function resolveProjectId(sa?: any): string | undefined {
  // Priorité aux env explicites
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  if (process.env.NEXT_PUBLIC_GCP_PROJECT) return process.env.NEXT_PUBLIC_GCP_PROJECT;

  // Essayer de lire le fichier pointé par GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const raw = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
      const json = JSON.parse(raw);
      if (json?.project_id) return json.project_id;
    } catch (_) { /* ignore */ }
  }

  // Si l'app admin est déjà initialisée, essayer de lire son projectId
  if (admin.apps.length) {
    const app = admin.app();
    // @ts-ignore
    if (app?.options?.projectId) return (app as any).options.projectId;
  }

  // Service account JSON
  if (sa?.project_id) return sa.project_id;

  // Firebase config éventuelle
  if (process.env.FIREBASE_CONFIG) {
    try {
      const cfg = JSON.parse(process.env.FIREBASE_CONFIG);
      if (cfg?.projectId) return cfg.projectId;
    } catch (_) { /* ignore */ }
  }

  return undefined;
}

function initPubSub() {
  if (pubsubClient || pubsubInitError) return;
  try {
    const sa = loadServiceAccount();
    projectId = resolveProjectId(sa);

    if (!projectId) {
      throw new Error('projectId missing; set GCLOUD_PROJECT or NEXT_PUBLIC_GCP_PROJECT');
    }

    pubsubClient = new PubSub({
      projectId,
      credentials: sa ?? undefined,
    });
  } catch (err) {
    pubsubInitError = err as Error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  initPubSub();
  if (!pubsubClient || pubsubInitError) {
    res.status(500).json({ error: pubsubInitError?.message ?? 'Pub/Sub non initialisé' });
    return;
  }

  const { initialSupply, decimals } = req.body as Body;
  const supply = Number(initialSupply ?? 0);
  const dec = Number(decimals ?? 0);

  if (!Number.isFinite(supply) || supply <= 0) {
    res.status(400).json({ error: 'initialSupply doit être > 0' });
    return;
  }
  if (!Number.isInteger(dec) || dec < 0 || dec > 9) {
    res.status(400).json({ error: 'decimals doit être un entier entre 0 et 9' });
    return;
  }

  try {
    const topicName = process.env.CREATE_SPL_TOKEN_TOPIC || 'create-spl-token';
    const messageBuffer = Buffer.from(JSON.stringify({ initialSupply: supply, decimals: dec }), 'utf8');
    const messageId = await pubsubClient.topic(topicName).publishMessage({ data: messageBuffer });
    res.status(200).json({ message: 'Publication envoyée', messageId, projectId });
  } catch (error: any) {
    console.error('Erreur publication Pub/Sub', error);
    res.status(500).json({ error: error?.message ?? 'Erreur Pub/Sub' });
  }
}
