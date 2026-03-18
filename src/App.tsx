/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Farmer, SoilData, UgandanLanguage } from './types';
import { Dashboard } from './components/Dashboard';
import { History } from './components/History';
import { Chatbot } from './components/Chatbot';
import { FarmerManager } from './components/FarmerManager';
import { ForecastView } from './components/ForecastView';
import { Toast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { exportToCSV } from './utils/export';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { User } from 'firebase/auth';
import { LogIn, LogOut, Loader2, Sprout, Users, Globe } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'history' | 'forecast'>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFarmerManagerOpen, setIsFarmerManagerOpen] = useState(false);
  const [history, setHistory] = useState<SoilData[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedSoilData, setSelectedSoilData] = useState<SoilData | null>(null);
  const [language, setLanguage] = useState<UgandanLanguage>('en');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; isVisible: boolean }>({
    message: '',
    isVisible: false,
  });

  // Track authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Listen for Firestore data changes
  useEffect(() => {
    if (!user || !isAuthReady) {
      setHistory([]);
      return;
    }

    const path = 'soil_tests';
    const q = query(collection(db, path), where('uid', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: SoilData[] = [];
      snapshot.forEach((doc) => {
        data.push({ ...doc.data() as SoilData, id: doc.id } as any);
      });
      setHistory(data.sort((a, b) => b.timestamp - a.timestamp));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Listen for Farmers
  useEffect(() => {
    if (!user || !isAuthReady) {
      setFarmers([]);
      return;
    }

    const path = 'farmers';
    const q = query(collection(db, path), where('uid', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Farmer[] = [];
      snapshot.forEach((doc) => {
        data.push({ ...doc.data() as Farmer, id: doc.id });
      });
      setFarmers(data.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleSaveData = async (data: SoilData) => {
    if (!user) return;
    const path = 'soil_tests';
    try {
      await addDoc(collection(db, path), {
        ...data,
        uid: user.uid,
      });
      setToast({ message: 'Soil test saved to cloud!', isVisible: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleDeleteData = async (timestamp: number) => {
    if (!user) return;
    const path = 'soil_tests';
    try {
      // In a real app, we'd use the document ID. For this demo, find by timestamp.
      const itemToDelete = history.find(item => item.timestamp === timestamp);
      if (itemToDelete && (itemToDelete as any).id) {
        await deleteDoc(doc(db, path, (itemToDelete as any).id));
        setToast({ message: 'Soil test deleted.', isVisible: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleExport = () => {
    exportToCSV(history);
    setToast({ message: 'Data exported to CSV.', isVisible: true });
  };

  const handleShareProfile = (profile: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'Farmer Partner Profile',
        text: profile,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(profile);
      setToast({ message: 'Profile copied to clipboard.', isVisible: true });
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('dashboard');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Initializing...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-8"
        >
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
            <Sprout size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Intelligent Soil</h1>
            <p className="text-gray-500 text-sm">Please sign in to access your soil data and agronomist AI.</p>
          </div>
          <button
            onClick={handleLogin}
            className="flex items-center justify-center space-x-3 bg-indigo-600 text-white w-full py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl active:scale-95"
          >
            <LogIn size={24} />
            <span>Sign in with Google</span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900 overflow-x-hidden">
        <div className="max-w-md mx-auto px-4 pt-4 flex justify-between items-center">
          <button 
            onClick={() => setIsFarmerManagerOpen(true)}
            className="flex items-center space-x-2 text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors"
          >
            <Users size={12} />
            <span>Farmers</span>
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors"
          >
            <LogOut size={12} />
            <span>Logout</span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <Dashboard 
                onSave={handleSaveData} 
                onViewData={() => setView('history')} 
                onOpenChat={() => setIsChatOpen(true)}
                onForecast={(data) => {
                  setSelectedSoilData(data);
                  setView('forecast');
                }}
                farmers={farmers}
                language={language}
              />
            </motion.div>
          ) : view === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <History 
                data={history} 
                onBack={() => setView('dashboard')} 
                onDelete={handleDeleteData}
                onExport={handleExport}
                onForecast={(data) => {
                  setSelectedSoilData(data);
                  setView('forecast');
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="forecast"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <ForecastView 
                groundTruth={selectedSoilData!}
                farmer={farmers.find(f => f.id === selectedSoilData?.farmerId)}
                language={language}
                onBack={() => setView('dashboard')}
                onShare={handleShareProfile}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isChatOpen && (
            <Chatbot 
              language={language}
              onLanguageChange={setLanguage}
              onClose={() => setIsChatOpen(false)} 
            />
          )}
          {isFarmerManagerOpen && (
            <FarmerManager user={user} onClose={() => setIsFarmerManagerOpen(false)} />
          )}
        </AnimatePresence>

        <Toast 
          message={toast.message} 
          isVisible={toast.isVisible} 
          onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
        />
      </div>
    </ErrorBoundary>
  );
}

