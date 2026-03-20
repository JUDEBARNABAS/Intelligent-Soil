/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Farmer, SoilData, UgandanLanguage, ForecastData } from './types';
import { Dashboard } from './components/Dashboard';
import { History } from './components/History';
import { Chatbot } from './components/Chatbot';
import { FarmerManager } from './components/FarmerManager';
import { ForecastView } from './components/ForecastView';
import { PartnerDashboard } from './components/PartnerDashboard';
import { KnowledgeBase } from './components/KnowledgeBase';
import { Toast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { exportToCSV } from './utils/export';
import { earthService } from './services/earthService';
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
import { LogIn, LogOut, Loader2, Sprout, Users, Globe, Smartphone, QrCode, X as CloseIcon, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'history' | 'forecast' | 'partner'>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFarmerManagerOpen, setIsFarmerManagerOpen] = useState(false);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
  const [isMobileAccessOpen, setIsMobileAccessOpen] = useState(false);
  const [history, setHistory] = useState<SoilData[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedSoilData, setSelectedSoilData] = useState<SoilData | null>(null);
  const [skyTruth, setSkyTruth] = useState<ForecastData | null>(null);
  const [language, setLanguage] = useState<UgandanLanguage>('en');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; isVisible: boolean }>({
    message: '',
    isVisible: false,
  });

  const getAppUrl = () => {
    if (process.env.SHARED_APP_URL && process.env.SHARED_APP_URL !== '') {
      return process.env.SHARED_APP_URL;
    }
    const base = process.env.APP_URL || window.location.origin;
    return base.replace('-dev-', '-pre-');
  };

  const appUrl = getAppUrl();

  const downloadQRCode = () => {
    const canvas = document.getElementById('mobile-qr-code') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'intelligent-soil-qr.png';
      link.href = url;
      link.click();
      setToast({ message: 'QR Code downloaded!', isVisible: true });
    }
  };

  // Fetch Sky Truth for the current soil data
  const lastFetchedId = useRef<string | null>(null);
  const isFetchingSkyTruth = useRef(false);

  useEffect(() => {
    const fetchSkyTruth = async () => {
      const dataToUse = selectedSoilData || (history.length > 0 ? history[0] : null);
      if (!dataToUse) {
        setSkyTruth(null);
        lastFetchedId.current = null;
        return;
      }

      const dataId = (dataToUse as any).id || dataToUse.timestamp.toString();
      if (dataId === lastFetchedId.current || isFetchingSkyTruth.current) return;

      try {
        isFetchingSkyTruth.current = true;
        const forecast = await earthService.getForecast(dataToUse);
        setSkyTruth(forecast);
        lastFetchedId.current = dataId;
      } catch (error: any) {
        console.error('Failed to fetch sky truth for chatbot:', error);
        // Don't set skyTruth to null if it failed, keep the old one if it's for the same ID
        // but here we want to clear it if it's a new ID
        if (dataId !== lastFetchedId.current) {
          setSkyTruth(null);
        }
      } finally {
        isFetchingSkyTruth.current = false;
      }
    };
    fetchSkyTruth();
  }, [selectedSoilData, history]);

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
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setView('partner')}
              className="flex items-center space-x-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors"
            >
              <Globe size={12} />
              <span>Intelligent Soil Partner Portal</span>
            </button>
            <button 
              onClick={() => setIsMobileAccessOpen(true)}
              className="flex items-center space-x-2 text-[10px] font-bold text-amber-600 uppercase tracking-widest hover:text-amber-700 transition-colors"
            >
              <Smartphone size={12} />
              <span>Mobile</span>
            </button>
          </div>
          <div className="flex items-center space-x-4">
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
        </div>

        <AnimatePresence>
          {isMobileAccessOpen && (
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
              onClick={() => setIsMobileAccessOpen(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white p-8 rounded-3xl shadow-2xl max-w-xs w-full text-center space-y-6 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => setIsMobileAccessOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2"
                >
                  <CloseIcon size={20} />
                </button>
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <QrCode size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">Mobile Access</h3>
                  <p className="text-gray-500 text-xs">Scan this code with your smartphone to open the app directly.</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-center shadow-inner">
                  <QRCodeCanvas 
                    id="mobile-qr-code"
                    value={appUrl} 
                    size={180}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="space-y-2">
                  <button
                    onClick={downloadQRCode}
                    className="w-full flex items-center justify-center space-x-2 bg-indigo-50 text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-all active:scale-95"
                  >
                    <Download size={18} />
                    <span>Download QR Code</span>
                  </button>
                  <button
                    onClick={() => setIsMobileAccessOpen(false)}
                    className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-95"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Or open this link:</p>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100 break-all text-[10px] font-mono text-indigo-600">
                      {appUrl}
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(appUrl);
                        setToast({ message: 'Link copied!', isVisible: true });
                      }}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"
                      title="Copy Link"
                    >
                      <Download size={14} className="rotate-180" />
                    </button>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 italic">Note: If you get a 403 error, make sure you are using the "Shared" version of the app.</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
                onAddFarmer={() => setIsFarmerManagerOpen(true)}
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
          ) : view === 'forecast' ? (
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
          ) : (
            <motion.div
              key="partner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <PartnerDashboard 
                onBack={() => setView('dashboard')} 
                onOpenKnowledgeBase={() => setIsKnowledgeBaseOpen(true)}
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
              groundTruth={selectedSoilData || (history.length > 0 ? history[0] : null)}
              skyTruth={skyTruth}
            />
          )}
          {isFarmerManagerOpen && (
            <FarmerManager user={user} onClose={() => setIsFarmerManagerOpen(false)} />
          )}
          {isKnowledgeBaseOpen && (
            <KnowledgeBase onClose={() => setIsKnowledgeBaseOpen(false)} />
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

