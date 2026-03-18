import React, { useState, useEffect } from 'react';
import { Farmer } from '../types';
import { db, collection, query, where, onSnapshot, addDoc, deleteDoc, doc, handleFirestoreError, OperationType } from '../firebase';
import { User } from 'firebase/auth';
import { UserPlus, Trash2, X, Plus, Phone, Mail, MapPin, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FarmerManagerProps {
  user: User;
  onClose: () => void;
}

export const FarmerManager: React.FC<FarmerManagerProps> = ({ user, onClose }) => {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newFarmer, setNewFarmer] = useState({
    name: '',
    phone: '',
    email: '',
    farmName: '',
    farmLocation: ''
  });

  useEffect(() => {
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
  }, [user]);

  const handleAddFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmer.name || !newFarmer.farmName) return;

    const path = 'farmers';
    try {
      await addDoc(collection(db, path), {
        ...newFarmer,
        uid: user.uid,
        createdAt: Date.now()
      });
      setNewFarmer({ name: '', phone: '', email: '', farmName: '', farmLocation: '' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleDeleteFarmer = async (id: string) => {
    const path = 'farmers';
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <header className="bg-emerald-600 p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <UserPlus size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg">Farmer Profiles</h2>
              <p className="text-[10px] opacity-70 uppercase tracking-widest">Manage your clients</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          <AnimatePresence mode="wait">
            {isAdding ? (
              <motion.form 
                key="add-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddFarmer}
                className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 space-y-4"
              >
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Farmer Name *</label>
                    <input 
                      required
                      type="text"
                      value={newFarmer.name}
                      onChange={e => setNewFarmer({...newFarmer, name: e.target.value})}
                      className="w-full p-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      placeholder="e.g. John Smith"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Farm Name *</label>
                    <input 
                      required
                      type="text"
                      value={newFarmer.farmName}
                      onChange={e => setNewFarmer({...newFarmer, farmName: e.target.value})}
                      className="w-full p-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      placeholder="e.g. Green Valley Farm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                      <input 
                        type="tel"
                        value={newFarmer.phone}
                        onChange={e => setNewFarmer({...newFarmer, phone: e.target.value})}
                        className="w-full p-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        placeholder="+1 234..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</label>
                      <input 
                        type="email"
                        value={newFarmer.email}
                        onChange={e => setNewFarmer({...newFarmer, email: e.target.value})}
                        className="w-full p-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        placeholder="john@farm.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Farm Location</label>
                    <input 
                      type="text"
                      value={newFarmer.farmLocation}
                      onChange={e => setNewFarmer({...newFarmer, farmLocation: e.target.value})}
                      className="w-full p-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      placeholder="e.g. North Plot, Sector 7"
                    />
                  </div>
                </div>
                <div className="flex space-x-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors text-sm shadow-lg"
                  >
                    Save Profile
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.div 
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <button 
                  onClick={() => setIsAdding(true)}
                  className="w-full p-4 border-2 border-dashed border-emerald-200 rounded-2xl flex items-center justify-center space-x-2 text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <Plus size={20} />
                  <span className="font-bold text-sm">Add New Farmer</span>
                </button>

                {farmers.map(farmer => (
                  <div key={farmer.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 group relative">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-bold text-gray-900">{farmer.name}</h3>
                        <div className="flex items-center space-x-2 text-emerald-600">
                          <Home size={12} />
                          <span className="text-xs font-medium">{farmer.farmName}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => farmer.id && handleDeleteFarmer(farmer.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {farmer.phone && (
                        <div className="flex items-center space-x-2 text-gray-400">
                          <Phone size={10} />
                          <span className="text-[10px]">{farmer.phone}</span>
                        </div>
                      )}
                      {farmer.email && (
                        <div className="flex items-center space-x-2 text-gray-400">
                          <Mail size={10} />
                          <span className="text-[10px] truncate">{farmer.email}</span>
                        </div>
                      )}
                      {farmer.farmLocation && (
                        <div className="flex items-center space-x-2 text-gray-400 col-span-2">
                          <MapPin size={10} />
                          <span className="text-[10px]">{farmer.farmLocation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {farmers.length === 0 && (
                  <div className="text-center py-10 opacity-40">
                    <p className="text-sm font-medium">No farmer profiles yet.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
