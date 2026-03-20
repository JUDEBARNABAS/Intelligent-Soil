import React, { useState, useEffect } from 'react';
import { SoilData, ForecastData, Farmer, UgandanLanguage } from '../types';
import { earthService } from '../services/earthService';
import { sunbirdService } from '../services/sunbirdService';
import { ArrowLeft, CloudRain, TrendingUp, Sprout, Share2, Loader2, Globe, MapPin, ExternalLink, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ForecastViewProps {
  groundTruth: SoilData;
  farmer?: Farmer;
  language: UgandanLanguage;
  onBack: () => void;
  onShare: (profile: string) => void;
}

export const ForecastView: React.FC<ForecastViewProps> = ({ groundTruth, farmer, language, onBack, onShare }) => {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [translatedForecast, setTranslatedForecast] = useState<ForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        setIsLoading(true);
        const data = await earthService.getForecast(groundTruth);
        setForecast(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchForecast();
  }, [groundTruth]);

  useEffect(() => {
    const translateForecast = async () => {
      if (!forecast || language === 'en') {
        setTranslatedForecast(null);
        return;
      }

      setIsTranslating(true);
      try {
        const [yieldT, weatherT, recommendationsT] = await Promise.all([
          sunbirdService.translate(forecast.yieldForecast, 'en', language),
          sunbirdService.translate(forecast.weatherForecast, 'en', language),
          sunbirdService.translate(forecast.agroecologicalRecommendations, 'en', language),
        ]);

        setTranslatedForecast({
          ...forecast,
          yieldForecast: yieldT,
          weatherForecast: weatherT,
          agroecologicalRecommendations: recommendationsT,
        });
      } catch (err) {
        console.error('Translation failed:', err);
      } finally {
        setIsTranslating(false);
      }
    };

    translateForecast();
  }, [forecast, language]);

  const [translatedLabels, setTranslatedLabels] = useState<Record<string, string>>({
    groundTruth: 'Ground Truth (Soil)',
    ph: 'pH',
    fertility: 'Fertility',
    npk: 'NPK'
  });

  useEffect(() => {
    const translateLabels = async () => {
      if (language === 'en') {
        setTranslatedLabels({
          groundTruth: 'Ground Truth (Soil)',
          ph: 'pH',
          fertility: 'Fertility',
          npk: 'NPK'
        });
        return;
      }

      try {
        const [gt, f] = await Promise.all([
          sunbirdService.translate('Ground Truth (Soil)', 'en', language),
          sunbirdService.translate('Fertility', 'en', language),
        ]);
        setTranslatedLabels(prev => ({
          ...prev,
          groundTruth: gt,
          fertility: f
        }));
      } catch (err) {
        console.error('Label translation failed:', err);
      }
    };
    translateLabels();
  }, [language]);

  const handleSpeak = async (text: string, id: string) => {
    if (isSpeaking) return;
    setIsSpeaking(id);
    try {
      const audioBase64 = await sunbirdService.textToSpeech(text, language);
      if (audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
        audio.onended = () => setIsSpeaking(null);
        await audio.play();
      } else {
        setIsSpeaking(null);
      }
    } catch (err) {
      console.error('TTS failed:', err);
      setIsSpeaking(null);
    }
  };

  const handleShare = () => {
    if (!forecast) return;
    const activeForecast = translatedForecast || forecast;
    const profile = `
      PARTNER PROFILE: ${farmer?.name || 'Unknown Farmer'}
      FARM: ${farmer?.farmName || 'Unknown Farm'}
      LOCATION: ${groundTruth.location?.latitude.toFixed(4)}, ${groundTruth.location?.longitude.toFixed(4)}
      
      GROUND TRUTH (Soil):
      - pH: ${groundTruth.ph}
      - Nitrogen: ${groundTruth.nitrogen}
      - Phosphorus: ${groundTruth.phosphorus}
      - Potassium: ${groundTruth.potassium}
      - Fertility: ${groundTruth.fertility}%
      
      SKY TRUTH (Soil and weather intelligence):
      - Yield Forecast: ${activeForecast.yieldForecast}
      - Weather: ${activeForecast.weatherForecast}
      - Agroecological Recommendations: ${activeForecast.agroecologicalRecommendations}
    `;
    onShare(profile);
  };

  const displayForecast = translatedForecast || forecast;

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <header className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Soil and weather intelligence</h1>
          <p className="text-[10px] text-indigo-600 uppercase tracking-widest font-bold">Ground + Sky Truth</p>
        </div>
        <div className="w-10" />
      </header>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 space-y-4"
          >
            <div className="relative">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
              <Globe className="absolute inset-0 m-auto text-indigo-300" size={20} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">Synthesizing Sky Truth...</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Soil and weather intelligence Foundation Model</p>
            </div>
          </motion.div>
        ) : error ? (
          <motion.div 
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center space-y-2"
          >
            <p className="text-red-600 text-sm font-bold">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="text-[10px] font-bold text-red-400 uppercase tracking-widest hover:underline"
            >
              Retry
            </button>
          </motion.div>
        ) : (
          <motion.div 
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {isTranslating && (
              <div className="flex items-center justify-center space-x-2 text-indigo-600 py-2 bg-indigo-50 rounded-xl animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Translating to {sunbirdService.getLanguageName(language)}...</span>
              </div>
            )}

            {/* Ground Truth Summary */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-indigo-600">
                  <MapPin size={16} />
                  <h2 className="text-xs font-bold uppercase tracking-widest">{translatedLabels.groundTruth}</h2>
                </div>
                {language !== 'en' && (
                  <button
                    onClick={() => handleSpeak(`${translatedLabels.groundTruth}. pH ${groundTruth.ph}. ${translatedLabels.fertility} ${groundTruth.fertility} percent.`, 'ground-truth')}
                    className={`p-1 rounded-full transition-colors ${isSpeaking === 'ground-truth' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-400'}`}
                  >
                    <Volume2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 p-2 rounded-xl text-center">
                  <p className="text-[8px] text-gray-400 uppercase font-bold">{translatedLabels.ph}</p>
                  <p className="text-sm font-bold">{groundTruth.ph}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-xl text-center">
                  <p className="text-[8px] text-gray-400 uppercase font-bold">{translatedLabels.fertility}</p>
                  <p className="text-sm font-bold">{groundTruth.fertility}%</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-xl text-center">
                  <p className="text-[8px] text-gray-400 uppercase font-bold">{translatedLabels.npk}</p>
                  <p className="text-sm font-bold">{groundTruth.nitrogen}/{groundTruth.phosphorus}/{groundTruth.potassium}</p>
                </div>
              </div>
            </div>

            {/* Sky Truth - Yield Forecast */}
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-3 relative group">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-600">
                  <TrendingUp size={16} />
                  <h2 className="text-xs font-bold uppercase tracking-widest">Yield Forecast</h2>
                </div>
                {language !== 'en' && (
                  <button 
                    onClick={() => handleSpeak(displayForecast!.yieldForecast, 'yield')}
                    className={`p-1.5 rounded-full transition-colors ${isSpeaking === 'yield' ? 'bg-emerald-600 text-white animate-pulse' : 'text-emerald-600 hover:bg-emerald-100'}`}
                  >
                    <Volume2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-sm text-emerald-900 leading-relaxed">{displayForecast?.yieldForecast}</p>
              {translatedForecast && (
                <p className="text-[9px] text-emerald-700/50 italic border-t border-emerald-100 pt-2">
                  Original: {forecast?.yieldForecast}
                </p>
              )}
            </div>

            {/* Sky Truth - Weather Forecast */}
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-3 relative group">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-blue-600">
                  <CloudRain size={16} />
                  <h2 className="text-xs font-bold uppercase tracking-widest">Weather Forecast</h2>
                </div>
                {language !== 'en' && (
                  <button 
                    onClick={() => handleSpeak(displayForecast!.weatherForecast, 'weather')}
                    className={`p-1.5 rounded-full transition-colors ${isSpeaking === 'weather' ? 'bg-blue-600 text-white animate-pulse' : 'text-blue-600 hover:bg-blue-100'}`}
                  >
                    <Volume2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-sm text-blue-900 leading-relaxed">{displayForecast?.weatherForecast}</p>
              {translatedForecast && (
                <p className="text-[9px] text-blue-700/50 italic border-t border-blue-100 pt-2">
                  Original: {forecast?.weatherForecast}
                </p>
              )}
            </div>

            {/* Agroecological Recommendations */}
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 space-y-3 relative group">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-600">
                  <Sprout size={16} />
                  <h2 className="text-xs font-bold uppercase tracking-widest">Agroecological Recommendations</h2>
                </div>
                {language !== 'en' && (
                  <button 
                    onClick={() => handleSpeak(displayForecast!.agroecologicalRecommendations, 'recs')}
                    className={`p-1.5 rounded-full transition-colors ${isSpeaking === 'recs' ? 'bg-amber-600 text-white animate-pulse' : 'text-amber-600 hover:bg-amber-100'}`}
                  >
                    <Volume2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-sm text-amber-900 leading-relaxed">{displayForecast?.agroecologicalRecommendations}</p>
              {translatedForecast && (
                <p className="text-[9px] text-amber-700/50 italic border-t border-amber-100 pt-2">
                  Original: {forecast?.agroecologicalRecommendations}
                </p>
              )}
            </div>

            {/* Sources */}
            {forecast?.skyTruthSource && forecast.skyTruthSource.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sky Truth Sources</h3>
                <div className="flex flex-wrap gap-2">
                  {forecast.skyTruthSource.map((url, i) => (
                    <a 
                      key={i} 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 bg-white border border-gray-100 px-2 py-1 rounded-full text-[8px] text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <ExternalLink size={8} />
                      <span className="truncate max-w-[100px]">{new URL(url).hostname}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleShare}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center space-x-3 shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Share2 size={20} />
              <span>Share Partner Profile</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
