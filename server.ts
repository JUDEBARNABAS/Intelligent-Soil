import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Admin
  // In AI Studio Build environment, the default credentials should be available
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }

  const db = admin.firestore();
  if (firebaseConfig.firestoreDatabaseId) {
    // Note: firebase-admin doesn't easily support named databases via initializeApp 
    // in the same way as the client SDK without a service account.
    // However, we can try to access it if needed.
    // For now, we'll assume the default database or that the environment handles it.
  }

  app.use(cors());
  app.use(express.json());

  // API Key Middleware for NGO endpoints
  const validateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.NGO_API_KEY;

    // Allow internal requests from the app itself (same origin)
    const referer = req.headers.referer || '';
    const isInternal = referer.includes(req.headers.host || '');

    if (isInternal || !validKey) {
      return next();
    }

    if (apiKey === validKey) {
      return next();
    }

    res.status(401).json({ error: 'Invalid or missing API key' });
  };

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', firebase: !!admin.apps.length });
  });

  // API Routes for NGOs
  app.get('/api/farmers', validateApiKey, async (req, res) => {
    try {
      const snapshot = await db.collection('farmers').orderBy('createdAt', 'desc').get();
      const farmers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(farmers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/farmers/:id/tests', validateApiKey, async (req, res) => {
    try {
      const snapshot = await db.collection('soil_tests')
        .where('farmerId', '==', req.params.id)
        .orderBy('timestamp', 'desc')
        .get();
      const tests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(tests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/ngo/dashboard', validateApiKey, async (req, res) => {
    try {
      const [farmersSnap, testsSnap] = await Promise.all([
        db.collection('farmers').get(),
        db.collection('soil_tests').orderBy('timestamp', 'desc').limit(100).get()
      ]);

      const farmers = farmersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const tests = testsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      res.json({
        totalFarmers: farmers.length,
        totalTests: tests.length,
        recentTests: tests,
        farmers: farmers
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
