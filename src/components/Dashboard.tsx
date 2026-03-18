import React, { useState, useEffect } from 'react';
import { SoilData, SensorKey, Farmer, UgandanLanguage } from '../types';
import { SENSOR_CONFIGS } from '../constants';
import { SensorCard } from './SensorCard';
import { ModbusSimulator } from '../services/modbusService';
import { useGeolocation } from '../hooks/useGeolocation';
import { sunbirdService } from '../services/sunbirdService';
import { MapPin, Save, Database, Loader2, Bot, User, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardProps {
  onSave: (data: SoilData) => void;
  onViewData: () => void;
  onOpenChat: () => void;
  onForecast: (data: SoilData) => void;
  farmers: Farmer[];
  language: UgandanLanguage;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSave, onViewData, onOpenChat, onForecast, farmers, language }) => {
  const [currentData, setCurrentData] = useState<Partial<SoilData> | null>(null);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('');
  const location = useGeolocation();
  const [isSaving, setIsSaving] = useState(false);
  const [labels, setLabels] = useState({
    title: 'Soil Testing',
    selectFarmer: 'Select Farmer Profile',
    noFarmer: 'No Farmer Selected',
    connected: 'Sensor connected and streaming data',
    connecting: 'Connecting to sensor...',
    save: 'Save',
    data: 'Data',
    locating: 'Locating...',
    gpsError: 'GPS Error'
  });

  useEffect(() => {
    const translateLabels = async () => {
      if (language === 'en') {
        setLabels({
          title: 'Soil Testing',
          selectFarmer: 'Select Farmer Profile',
          noFarmer: 'No Farmer Selected',
          connected: 'Sensor connected and streaming data',
          connecting: 'Connecting to sensor...',
          save: 'Save',
          data: 'Data',
          locating: 'Locating...',
          gpsError: 'GPS Error'
        });
        return;
      }

      try {
        const [title, select, none, conn, conning, save, data, loc, gps] = await Promise.all([
          sunbirdService.translate('Soil Testing', 'en', language),
          sunbirdService.translate('Select Farmer Profile', 'en', language),
          sunbirdService.translate('No Farmer Selected', 'en', language),
          sunbirdService.translate('Sensor connected and streaming data', 'en', language),
          sunbirdService.translate('Connecting to sensor...', 'en', language),
          sunbirdService.translate('Save', 'en', language),
          sunbirdService.translate('Data', 'en', language),
          sunbirdService.translate('Locating...', 'en', language),
          sunbirdService.translate('GPS Error', 'en', language),
        ]);

        setLabels({
          title,
          selectFarmer: select,
          noFarmer: none,
          connected: conn,
          connecting: conning,
          save,
          data,
          locating: loc,
          gpsError: gps
        });
      } catch (err) {
        console.error('Dashboard label translation failed:', err);
      }
    };
    translateLabels();
  }, [language]);

  useEffect(() => {
    const simulator = new ModbusSimulator((data) => {
      setCurrentData(prev => ({ ...prev, ...data }));
    });
    simulator.start();
    return () => simulator.stop();
  }, []);

  const getFullData = (): SoilData | null => {
    if (!currentData) return null;
    const selectedFarmer = farmers.find(f => f.id === selectedFarmerId);
    return {
      temperature: currentData.temperature || 0,
      humidity: currentData.humidity || 0,
      conductivity: currentData.conductivity || 0,
      ph: currentData.ph || 0,
      nitrogen: currentData.nitrogen || 0,
      phosphorus: currentData.phosphorus || 0,
      potassium: currentData.potassium || 0,
      fertility: currentData.fertility || 0,
      timestamp: Date.now(),
      farmerId: selectedFarmerId || undefined,
      farmerName: selectedFarmer?.name || undefined,
      location: location.latitude && location.longitude ? {
        latitude: location.latitude,
        longitude: location.longitude,
      } : undefined,
    };
  };

  const handleSave = async () => {
    const fullData = getFullData();
    if (!fullData) return;
    setIsSaving(true);
    await onSave(fullData);
    setIsSaving(false);
  };

  const handleForecast = () => {
    const fullData = getFullData();
    if (fullData) onForecast(fullData);
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <MapPin size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{labels.title}</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Intelligent Soil</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleForecast}
            disabled={!currentData}
            className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            title="Alfa Earth Forecast"
          >
            <Globe size={20} />
          </button>
          <button 
            onClick={onOpenChat}
            className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-indigo-700 transition-colors"
          >
            <Bot size={20} />
          </button>
        </div>
      </header>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-1">
          <User size={10} />
          <span>{labels.selectFarmer}</span>
        </label>
        <select 
          value={selectedFarmerId}
          onChange={(e) => setSelectedFarmerId(e.target.value)}
          className="w-full p-3 bg-white border-2 border-gray-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-green-500 border-none shadow-sm"
        >
          <option value="">{labels.noFarmer}</option>
          {farmers.map(farmer => (
            <option key={farmer.id} value={farmer.id}>
              {farmer.name} ({farmer.farmName})
            </option>
          ))}
        </select>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center space-x-3">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <p className="text-xs text-blue-800 font-medium">
          {currentData ? labels.connected : labels.connecting}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {SENSOR_CONFIGS.map((config, index) => (
          <motion.div
            key={config.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <SensorCard
              config={config}
              value={currentData?.[config.key as SensorKey] ?? null}
              language={language}
            />
          </motion.div>
        ))}
      </div>

      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-gray-600">
          <MapPin size={14} />
          <span className="text-[10px] font-mono">
            {location.latitude ? `${location.latitude.toFixed(4)}, ${location.longitude?.toFixed(4)}` : labels.locating}
          </span>
        </div>
        {location.error && <span className="text-[10px] text-red-500">{labels.gpsError}</span>}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving || !currentData}
          className="flex items-center justify-center space-x-2 bg-white border-2 border-gray-200 py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          <span>{labels.save}</span>
        </button>
        <button
          onClick={onViewData}
          className="flex items-center justify-center space-x-2 bg-blue-600 py-3 rounded-xl font-bold text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Database size={20} />
          <span>{labels.data}</span>
        </button>
      </div>
    </div>
  );
};
