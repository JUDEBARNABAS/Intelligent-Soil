import React, { useState, useEffect } from 'react';
import { SoilData, SensorKey, Farmer, UgandanLanguage } from '../types';
import { SENSOR_CONFIGS } from '../constants';
import { SensorCard } from './SensorCard';
import { ModbusSimulator, WebSerialModbus } from '../services/modbusService';
import { useGeolocation } from '../hooks/useGeolocation';
import { sunbirdService } from '../services/sunbirdService';
import { MapPin, Save, Database, Loader2, Bot, User, Globe, Smartphone, Link, Unlink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
  onSave: (data: SoilData) => void;
  onViewData: () => void;
  onOpenChat: () => void;
  onForecast: (data: SoilData) => void;
  onAddFarmer: () => void;
  farmers: Farmer[];
  language: UgandanLanguage;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSave, onViewData, onOpenChat, onForecast, onAddFarmer, farmers, language }) => {
  const [currentData, setCurrentData] = useState<Partial<SoilData> | null>(null);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('');
  const location = useGeolocation();
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isRealSensorConnected, setIsRealSensorConnected] = useState(false);
  const [serialModbus] = useState(() => new WebSerialModbus());
  const [workflowStep, setWorkflowStep] = useState<number>(0); // 0: Select/Add, 1: Scan, 2: Consult AI, 3: Soil & Weather, 4: Share
  const [labels, setLabels] = useState({
    title: 'Soil Testing',
    selectFarmer: 'Select Farmer Profile',
    noFarmer: 'No Farmer Selected',
    connected: 'Sensor connected and streaming data',
    connecting: 'Connecting to sensor...',
    save: 'Save',
    data: 'Data',
    locating: 'Locating...',
    gpsError: 'GPS Error',
    scan: 'Scan Sensor',
    scanning: 'Scanning Soil...',
    connect: 'Connect USB Sensor',
    disconnect: 'Disconnect Sensor',
    next: 'Next Step',
    previous: 'Previous',
    step1: '1. Select Farmer',
    step2: '2. Test Soil',
    step3: '3. Consult AI',
    step4: '4. Soil & Weather',
    step5: '5. Share Profile'
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
          gpsError: 'GPS Error',
          scan: 'Scan Sensor',
          scanning: 'Scanning Soil...',
          connect: 'Connect USB Sensor',
          disconnect: 'Disconnect Sensor',
          next: 'Next Step',
          previous: 'Previous',
          step1: '1. Select Farmer',
          step2: '2. Test Soil',
          step3: '3. Consult AI',
          step4: '4. Soil & Weather',
          step5: '5. Share Profile'
        });
        return;
      }

      try {
        const [title, select, none, conn, conning, save, data, loc, gps, scan, scanning, connect, disconnect, next, prev, s1, s2, s3, s4, s5] = await Promise.all([
          sunbirdService.translate('Soil Testing', 'en', language),
          sunbirdService.translate('Select Farmer Profile', 'en', language),
          sunbirdService.translate('No Farmer Selected', 'en', language),
          sunbirdService.translate('Sensor connected and streaming data', 'en', language),
          sunbirdService.translate('Connecting to sensor...', 'en', language),
          sunbirdService.translate('Save', 'en', language),
          sunbirdService.translate('Data', 'en', language),
          sunbirdService.translate('Locating...', 'en', language),
          sunbirdService.translate('GPS Error', 'en', language),
          sunbirdService.translate('Scan Sensor', 'en', language),
          sunbirdService.translate('Scanning Soil...', 'en', language),
          sunbirdService.translate('Connect USB Sensor', 'en', language),
          sunbirdService.translate('Disconnect Sensor', 'en', language),
          sunbirdService.translate('Next Step', 'en', language),
          sunbirdService.translate('Previous', 'en', language),
          sunbirdService.translate('1. Select Farmer', 'en', language),
          sunbirdService.translate('2. Test Soil', 'en', language),
          sunbirdService.translate('3. Consult AI', 'en', language),
          sunbirdService.translate('4. Soil & Weather', 'en', language),
          sunbirdService.translate('5. Share Profile', 'en', language),
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
          gpsError: gps,
          scan,
          scanning,
          connect,
          disconnect,
          next,
          previous: prev,
          step1: s1,
          step2: s2,
          step3: s3,
          step4: s4,
          step5: s5
        });
      } catch (err) {
        console.error('Dashboard label translation failed:', err);
      }
    };
    translateLabels();
  }, [language]);

  const [showOTGGuide, setShowOTGGuide] = useState(false);

  useEffect(() => {
    if (!selectedFarmerId && farmers.length > 0) {
      // Find the most recently added farmer (assuming higher ID or just the last one in the array)
      const lastFarmer = farmers[farmers.length - 1];
      setSelectedFarmerId(lastFarmer.id);
    }
  }, [farmers, selectedFarmerId]);

  const handleConnectSensor = async () => {
    // @ts-ignore
    const isSerialSupported = !!navigator.serial || !!navigator.usb;
    
    if (!isSerialSupported) {
      alert('USB/Serial is not supported in this browser. \n\n1. Use Chrome on Android.\n2. Open the app in a NEW TAB (square icon top-right).\n3. Ensure OTG is enabled in your phone settings.');
      return;
    }

    if (isRealSensorConnected) {
      try {
        await serialModbus.disconnect();
        setIsRealSensorConnected(false);
      } catch (err) {
        console.error('Disconnect failed:', err);
      }
    } else {
      try {
        const success = await serialModbus.connect();
        if (success) {
          setIsRealSensorConnected(true);
          setShowOTGGuide(false);
        } else {
          setShowOTGGuide(true);
        }
      } catch (err: any) {
        console.error('Connection error:', err);
        if (err.name === 'SecurityError' || err.message?.includes('SecurityError')) {
          alert('Security Error: USB access is blocked in this preview window.\n\nFIX: Click the "Open in new tab" button (square icon with arrow in top-right) to use the physical sensor.');
        } else if (err.name === 'NotFoundError') {
          setShowOTGGuide(true);
        } else {
          alert(`Connection failed: ${err.message}\n\nTip: Check if your phone requires manual OTG activation in Settings.`);
        }
      }
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanProgress(0);
    setCurrentData(null);

    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 5;
      });
    }, 100);

    try {
      let data: Partial<SoilData> | null = null;
      if (isRealSensorConnected) {
        data = await serialModbus.readSensor();
      } else {
        // Simulate
        data = {
          temperature: parseFloat((20 + Math.random() * 10).toFixed(1)),
          humidity: parseFloat((40 + Math.random() * 20).toFixed(1)),
          conductivity: Math.floor(300 + Math.random() * 200),
          ph: parseFloat((5.5 + Math.random() * 1.5).toFixed(1)),
          nitrogen: Math.floor(20 + Math.random() * 10),
          phosphorus: Math.floor(30 + Math.random() * 15),
          potassium: Math.floor(35 + Math.random() * 10),
          fertility: Math.floor(70 + Math.random() * 30),
        };
      }
      
      setScanProgress(100);
      setTimeout(() => {
        setCurrentData(data);
        setIsScanning(false);
      }, 500);
    } catch (err) {
      console.error('Scan failed:', err);
      setIsScanning(false);
    }
  };

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
    setWorkflowStep(2); // Move to Consult AI
  };

  const handleForecast = () => {
    const fullData = getFullData();
    if (fullData) {
      onForecast(fullData);
      setWorkflowStep(4); // Move to Share Profile
    }
  };

  const steps = [
    { label: labels.step1, icon: User },
    { label: labels.step2, icon: Smartphone },
    { label: labels.step3, icon: Bot },
    { label: labels.step4, icon: Globe },
    { label: labels.step5, icon: Link },
  ];

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
            onClick={onOpenChat}
            className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-indigo-700 transition-colors"
          >
            <Bot size={20} />
          </button>
        </div>
      </header>

      {/* Workflow Progress */}
      <div className="flex justify-between items-center px-2">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center space-y-1">
            <button
              onClick={() => index < workflowStep && setWorkflowStep(index)}
              disabled={index > workflowStep}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                index === workflowStep 
                  ? 'bg-indigo-600 text-white shadow-lg scale-110' 
                  : index < workflowStep 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              <step.icon size={14} />
            </button>
            <span className={`text-[8px] font-bold uppercase tracking-tighter ${index === workflowStep ? 'text-indigo-600' : 'text-gray-400'}`}>
              Step {index + 1}
            </span>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {workflowStep === 0 && (
          <motion.div
            key="step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-1">
                  <User size={10} />
                  <span>{labels.selectFarmer}</span>
                </label>
                <div className="flex space-x-2">
                  <select 
                    value={selectedFarmerId}
                    onChange={(e) => setSelectedFarmerId(e.target.value)}
                    className="flex-1 p-3 bg-white border-2 border-gray-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-green-500 border-none shadow-sm"
                  >
                    <option value="">{labels.noFarmer}</option>
                    {farmers.map(farmer => (
                      <option key={farmer.id} value={farmer.id}>
                        {farmer.name} ({farmer.farmName})
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={onAddFarmer}
                    className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-colors"
                    title="Add New Farmer"
                  >
                    <User size={20} />
                  </button>
                </div>
              </div>
              
              <button
                disabled={!selectedFarmerId}
                onClick={() => setWorkflowStep(1)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {labels.next}
              </button>
            </div>
          </motion.div>
        )}

        {workflowStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* @ts-ignore */}
            {(!navigator.serial && !navigator.usb || window.self !== window.top) && (
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-center space-x-3">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                  <Smartphone size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-amber-900 font-bold uppercase tracking-widest">USB Sensor Restricted</p>
                  <p className="text-[10px] text-amber-700">Open the app in a <strong>NEW TAB</strong> (square icon top-right) to use the physical sensor probe via OTG.</p>
                </div>
              </div>
            )}

            {showOTGGuide && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2 text-red-600">
                  <Smartphone size={18} />
                  <h3 className="font-bold text-sm uppercase tracking-widest">OTG Troubleshooting</h3>
                </div>
                <ul className="text-xs text-red-800 space-y-2 list-disc pl-4">
                  <li><strong>Xiaomi/Mi Tip:</strong> Go to <strong>Settings &gt; Additional Settings</strong> and look for <strong>OTG</strong>. If not there, it's usually on by default, but try a different adapter.</li>
                  <li><strong>Enable OTG:</strong> Go to Phone Settings, search for <strong>"OTG"</strong>, and turn it <strong>ON</strong>. (Many phones turn it off automatically).</li>
                  <li><strong>Check Cable:</strong> Ensure your OTG adapter supports <strong>Data</strong> (some are power-only).</li>
                  <li><strong>Open in New Tab:</strong> Use the square icon at the top right to leave the preview window.</li>
                  <li><strong>Chrome Only:</strong> Use Chrome on Android. Built-in browsers (like Mi Browser) often block USB.</li>
                </ul>
                <button 
                  onClick={() => setShowOTGGuide(false)}
                  className="w-full py-2 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg hover:bg-red-200 uppercase tracking-widest"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${currentData ? 'bg-green-500 animate-pulse' : (isRealSensorConnected ? 'bg-blue-500' : 'bg-amber-500')}`} />
                  <p className="text-xs text-blue-800 font-medium">
                    {isRealSensorConnected ? 'USB Sensor Connected' : (currentData ? labels.connected : labels.connecting)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleConnectSensor}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-[10px] font-bold transition-colors shadow-sm ${
                      isRealSensorConnected 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isRealSensorConnected ? <Unlink size={12} /> : <Link size={12} />}
                    <span>{isRealSensorConnected ? labels.disconnect : labels.connect}</span>
                  </button>
                  {!isScanning && (
                    <button
                      onClick={handleScan}
                      className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      {labels.scan}
                    </button>
                  )}
                </div>
              </div>
              
              {isScanning && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                    <span>{labels.scanning}</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {!currentData && !isScanning && (
              <button
                onClick={handleScan}
                className="w-full py-12 border-2 border-dashed border-blue-300 rounded-3xl flex flex-col items-center justify-center space-y-4 bg-blue-50/50 hover:bg-blue-50 transition-all group"
              >
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                  <Smartphone size={32} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-blue-900">{labels.scan}</h3>
                  <p className="text-xs text-blue-600 font-medium">Connect probe and tap to start</p>
                </div>
              </button>
            )}

            {(currentData || isScanning) && (
              <div className="grid grid-cols-2 gap-4">
                {SENSOR_CONFIGS.map((config, index) => (
                  <SensorCard
                    key={config.key}
                    config={config}
                    value={currentData?.[config.key as SensorKey] ?? null}
                    language={language}
                  />
                ))}
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={() => setWorkflowStep(0)}
                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                {labels.previous}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !currentData}
                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                <span>Save & Next</span>
              </button>
            </div>
          </motion.div>
        )}

        {workflowStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 text-center"
          >
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <Bot size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900">Consult AI Agronomist</h3>
              <p className="text-sm text-gray-500">Get expert advice based on the soil scan results and local conditions.</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={onOpenChat}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center space-x-2"
              >
                <Bot size={20} />
                <span>Start Consultation</span>
              </button>
              <button
                onClick={() => setWorkflowStep(3)}
                className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Skip to Soil & Weather
              </button>
            </div>
          </motion.div>
        )}

        {workflowStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 text-center"
          >
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <Globe size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900">Soil and weather intelligence Insights</h3>
              <p className="text-sm text-gray-500">Check satellite-informed forecasts and regional agricultural trends.</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleForecast}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center space-x-2"
              >
                <Globe size={20} />
                <span>Check Soil & Weather</span>
              </button>
              <button
                onClick={() => setWorkflowStep(4)}
                className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Skip to Share
              </button>
            </div>
          </motion.div>
        )}

        {workflowStep === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 text-center"
          >
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <Link size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900">Operation Complete!</h3>
              <p className="text-sm text-gray-500">The farmer's profile and soil data are ready to be shared.</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleForecast}
                className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold shadow-xl hover:bg-green-700 transition-all active:scale-95 flex items-center justify-center space-x-2"
              >
                <Database size={20} />
                <span>View & Share Profile</span>
              </button>
              <button
                onClick={() => {
                  setWorkflowStep(0);
                  setSelectedFarmerId('');
                  setCurrentData(null);
                }}
                className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-100 transition-all"
              >
                Start New Operation
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-gray-600">
          <MapPin size={14} />
          <span className="text-[10px] font-mono">
            {location.latitude ? `${location.latitude.toFixed(4)}, ${location.longitude?.toFixed(4)}` : labels.locating}
          </span>
        </div>
        {location.error && <span className="text-[10px] text-red-500">{labels.gpsError}</span>}
      </div>
    </div>
  );
};
