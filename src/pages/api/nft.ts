// pages/api/nft.js

const admin = require('firebase-admin');

// Vérifiez si l'application admin a déjà été initialisée
if (!admin.apps.length) {
  const serviceAccount = require('../../../loyum-417114-firebase-adminsdk-9co2d-c65c161744.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Extraire les données de la requête
    const { mintAddress, metadata, owner } = req.body;

    try {
      // Insérer les données dans la collection NFT
      const docRef = await db.collection('NFTs').add({
        mintAddress,
        metadata,
        owner,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(200).json({ message: 'NFT ajouté avec succès', id: docRef.id });
    } catch (error) {
      console.error('Erreur lors de l\'ajout du NFT:', error);
      res.status(500).json({ error: 'Erreur lors de l\'ajout du NFT' });
    }
  } else {
    res.status(405).json({ error: 'Méthode non autorisée' });
  }
}