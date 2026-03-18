import React from 'react';
import { SoilData } from '../types';
import { SENSOR_CONFIGS } from '../constants';
import { format } from 'date-fns';
import { ArrowLeft, Download, MapPin, Trash2, ChevronRight, Globe, Database } from 'lucide-react';
import { motion } from 'framer-motion';

interface HistoryProps {
  data: SoilData[];
  onBack: () => void;
  onDelete: (timestamp: number) => void;
  onExport: () => void;
  onForecast: (data: SoilData) => void;
}

export const History: React.FC<HistoryProps> = ({ data, onBack, onDelete, onExport, onForecast }) => {
  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <header className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Soil History</h1>
        <button 
          onClick={onExport}
          disabled={data.length === 0}
          className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          <Download size={20} />
        </button>
      </header>

      <div className="space-y-4">
        {data.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Database size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm">No soil tests saved yet.</p>
          </div>
        ) : (
          data.sort((a, b) => b.timestamp - a.timestamp).map((item, index) => (
            <motion.div
              key={item.timestamp}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-900">
                    {format(item.timestamp, 'MMM d, yyyy • HH:mm')}
                  </p>
                  {item.farmerName && (
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                      Farmer: {item.farmerName}
                    </p>
                  )}
                  {item.location && (
                    <div className="flex items-center space-x-1 text-[10px] text-gray-500">
                      <MapPin size={10} />
                      <span>{item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => onForecast(item)}
                    className="text-emerald-500 hover:text-emerald-700 transition-colors p-1"
                    title="Alfa Earth Intelligence"
                  >
                    <Globe size={16} />
                  </button>
                  <button 
                    onClick={() => onDelete(item.timestamp)}
                    className="text-red-400 hover:text-red-600 transition-colors p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {SENSOR_CONFIGS.map(config => (
                  <div key={config.key} className="text-center">
                    <p className="text-[8px] text-gray-400 uppercase font-bold truncate">{config.label}</p>
                    <p className="text-xs font-mono font-bold text-gray-700">
                      {item[config.key as keyof SoilData] as number}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
