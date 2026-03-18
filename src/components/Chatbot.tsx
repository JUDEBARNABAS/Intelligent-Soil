import React, { useState, useEffect, useRef } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { Bot, Mic, MicOff, X, MessageSquare, AlertCircle, Loader2, Video, VideoOff, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UGANDAN_LANGUAGES, UgandanLanguage, SoilData, ForecastData } from '../types';

interface ChatbotProps {
  language: UgandanLanguage;
  onLanguageChange: (lang: UgandanLanguage) => void;
  onClose: () => void;
  groundTruth?: SoilData | null;
  skyTruth?: ForecastData | null;
}

export const Chatbot: React.FC<ChatbotProps> = ({ 
  language, 
  onLanguageChange, 
  onClose,
  groundTruth,
  skyTruth
}) => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const {
    isConnected,
    isRecording,
    isCameraOn,
    targetLanguage,
    setTargetLanguage,
    transcript,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    startCamera,
    stopCamera
  } = useGeminiLive(apiKey, groundTruth, skyTruth);

  useEffect(() => {
    setTargetLanguage(language);
  }, [language, setTargetLanguage]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleLanguageSelect = (lang: UgandanLanguage) => {
    onLanguageChange(lang);
    setShowLanguages(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleConnect = async () => {
    setIsConnecting(true);
    await connect();
    setIsConnecting(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else if (videoRef.current) {
      startCamera(videoRef.current);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <header className="bg-indigo-600 p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Bot size={24} />
            </div>
            <div>
              <h2 className="font-bold">AI Agronomist</h2>
              <p className="text-[10px] opacity-70 uppercase tracking-widest">Gemini Multimodal Live</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowLanguages(!showLanguages)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showLanguages ? 'bg-white text-indigo-600' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              <Globe size={18} />
            </button>
            <button 
              onClick={() => {
                disconnect();
                onClose();
              }}
              className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <AnimatePresence>
          {showLanguages && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-indigo-50 border-b border-indigo-100 overflow-hidden"
            >
              <div className="p-3 grid grid-cols-3 gap-2">
                {UGANDAN_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${language === lang.code ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-600 hover:bg-indigo-100'}`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative bg-black aspect-video overflow-hidden">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transition-opacity duration-500 ${isCameraOn ? 'opacity-100' : 'opacity-0'}`}
          />
          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 flex-col space-y-2">
              <VideoOff size={48} className="opacity-20" />
              <span className="text-xs font-bold uppercase tracking-widest opacity-40">Camera Off</span>
            </div>
          )}
          {isCameraOn && (
            <div className="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
              <span>LIVE FEED</span>
            </div>
          )}
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 min-h-[200px]"
        >
          {transcript.length === 0 && !isConnected && !isConnecting && (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <MessageSquare size={32} />
              </div>
              <p className="text-sm text-gray-500 max-w-[200px] mx-auto">
                Connect to start a multimodal live conversation with our AI Agronomist.
              </p>
              <button 
                onClick={handleConnect}
                className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition-all"
              >
                Connect Now
              </button>
            </div>
          )}

          {isConnecting && (
            <div className="flex items-center justify-center py-10 space-x-2 text-indigo-600">
              <Loader2 className="animate-spin" size={24} />
              <span className="font-bold">Connecting...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center space-x-3 text-red-600 text-xs">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <AnimatePresence>
            {transcript.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none shadow-sm'
                }`}>
                  {msg.translatedText || msg.text}
                  {msg.translatedText && (
                    <p className="text-[8px] opacity-50 mt-1 italic border-t border-gray-100 pt-1">
                      Original: {msg.text}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {isConnected && (
          <div className="p-6 bg-white border-t border-gray-100 flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-6">
              <div className="flex flex-col items-center space-y-2">
                <button 
                  onClick={toggleRecording}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ${
                    isRecording 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {isRecording ? 'Mute' : 'Unmute'}
                </span>
              </div>

              <div className="flex flex-col items-center space-y-2">
                <button 
                  onClick={toggleCamera}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ${
                    isCameraOn 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                >
                  {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
                </button>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {isCameraOn ? 'Cam On' : 'Cam Off'}
                </span>
              </div>
            </div>
            
            <p className="text-[10px] text-gray-400 font-medium">
              {isRecording ? 'AI is listening to you...' : 'Tap microphone to speak'}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
