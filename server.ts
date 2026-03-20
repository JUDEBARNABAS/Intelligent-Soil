import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import fs from 'fs';
import { Farmer, SoilData } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase config safely
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8'));

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  console.log(`Starting server on port ${PORT}...`);

  // Initialize Firebase Admin
  // In AI Studio Build environment, the default credentials should be available
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }

  const db = firebaseConfig.firestoreDatabaseId 
    ? admin.firestore(firebaseConfig.firestoreDatabaseId)
    : admin.firestore();

  app.use(cors());
  app.use(express.json());

  // API Key Middleware for Partner endpoints
  const validateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.PARTNER_API_KEY || process.env.NGO_API_KEY;

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

  app.get('/api/health', async (req, res) => {
    try {
      const [farmersSnap, testsSnap] = await Promise.all([
        db.collection('farmers').count().get(),
        db.collection('soil_tests').count().get()
      ]);
      res.json({ 
        status: 'ok', 
        firebase: !!admin.apps.length,
        farmerCount: farmersSnap.data().count,
        testCount: testsSnap.data().count
      });
    } catch (error: any) {
      res.json({ status: 'error', message: error.message });
    }
  });

  // API Routes for Partners
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

  app.get('/api/partner/dashboard', validateApiKey, async (req, res) => {
    try {
      console.log('[API] Fetching partner dashboard data...');
      const farmersSnap = await db.collection('farmers').get();
      const testsSnap = await db.collection('soil_tests').orderBy('timestamp', 'desc').get();

      console.log(`[API] Found ${farmersSnap.size} farmers and ${testsSnap.size} soil tests.`);

      const farmers = farmersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as Farmer }));
      const tests = testsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as SoilData }));

      // Map latest test to each farmer for easier frontend consumption
      const farmersWithLatestTest = farmers.map(farmer => {
        const latestTest = tests.find(t => t.farmerId === farmer.id);
        return {
          ...farmer,
          latestTest: latestTest || null
        };
      });

      res.json({
        totalFarmers: farmers.length,
        totalTests: tests.length,
        recentTests: tests.slice(0, 100), // Keep recent tests for charts
        farmers: farmersWithLatestTest,
        debug: {
          farmersCount: farmersSnap.size,
          testsCount: testsSnap.size,
          timestamp: Date.now()
        }
      });
    } catch (error: any) {
      console.error('[API] Dashboard Error:', error);
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
