import React, { useState, useEffect } from 'react';
import { SensorConfig, UgandanLanguage } from '../types';
import * as LucideIcons from 'lucide-react';
import { sunbirdService } from '../services/sunbirdService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SensorCardProps {
  config: SensorConfig;
  value: number | string | null;
  language: UgandanLanguage;
}

export const SensorCard: React.FC<SensorCardProps> = ({ config, value, language }) => {
  const Icon = (LucideIcons as any)[config.icon];
  const [translatedLabel, setTranslatedLabel] = useState(config.label);

  useEffect(() => {
    const translate = async () => {
      if (language === 'en') {
        setTranslatedLabel(config.label);
        return;
      }
      try {
        const translated = await sunbirdService.translate(config.label, 'en', language);
        setTranslatedLabel(translated);
      } catch (err) {
        console.error('Sensor label translation failed:', err);
      }
    };
    translate();
  }, [config.label, language]);

  return (
    <div className={cn(
      "p-4 rounded-2xl border flex flex-col items-center justify-center space-y-2 transition-all duration-300 hover:shadow-md",
      config.color
    )}>
      <div className="flex items-center space-x-2">
        {Icon && <Icon size={20} />}
        <span className="text-xs font-semibold uppercase tracking-wider opacity-80">{translatedLabel}</span>
      </div>
      <div className="text-center">
        <span className="text-2xl font-bold font-mono">
          {value === null ? '--' : value}
        </span>
        <span className="text-[10px] ml-1 opacity-70">{config.unit}</span>
      </div>
    </div>
  );
};
