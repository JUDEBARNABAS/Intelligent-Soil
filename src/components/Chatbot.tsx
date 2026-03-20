import React, { useState, useEffect, useRef } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { Bot, Mic, MicOff, X, MessageSquare, AlertCircle, Loader2, Video, VideoOff, Globe, RefreshCw } from 'lucide-react';
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
    status,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    startCamera,
    stopCamera,
    switchCamera,
    sendTextMessage
  } = useGeminiLive(apiKey, groundTruth, skyTruth);

  const [textInput, setTextInput] = useState('');

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
    // Restart connection with new language to update system instructions
    disconnect();
    setTimeout(() => handleConnect(), 500);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    handleConnect();
    return () => {
      disconnect();
    };
  }, []);

  const handleConnect = async () => {
    if (isConnected || isConnecting) return;
    setIsConnecting(true);
    try {
      await connect();
    } catch (err) {
      console.error('Connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
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

  const handleSwitchCamera = () => {
    if (videoRef.current) {
      switchCamera(videoRef.current);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      sendTextMessage(textInput.trim());
      setTextInput('');
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
              <h2 className="font-bold">Intelligent Soil Agronomist</h2>
              <p className="text-[10px] opacity-70 uppercase tracking-widest">Expert Agricultural Advice</p>
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
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-md z-[70] flex flex-col p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-indigo-900">Select Language</h3>
                <button 
                  onClick={() => setShowLanguages(false)}
                  className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 overflow-y-auto">
                {UGANDAN_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={`flex items-center justify-between px-6 py-4 rounded-2xl text-sm font-bold transition-all ${language === lang.code ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                  >
                    <div className="flex items-center space-x-3">
                      <Globe size={18} className={language === lang.code ? 'text-white' : 'text-indigo-400'} />
                      <span>{lang.name}</span>
                    </div>
                    {language === lang.code && <div className="w-3 h-3 bg-white rounded-full shadow-sm" />}
                  </button>
                ))}
              </div>
              <p className="mt-6 text-[10px] text-center text-gray-400 uppercase tracking-widest font-medium">
                The agronomist will restart to apply the language change
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 p-2 text-red-600 text-[10px] flex items-center justify-between px-4">
            <div className="flex items-center space-x-2">
              <div className="w-1 h-1 bg-red-600 rounded-full" />
              <span>{error}</span>
            </div>
            <button onClick={() => handleConnect()} className="underline font-bold">Retry</button>
          </div>
        )}

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
            <>
              <div className="absolute top-4 left-4 bg-red-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse flex items-center space-x-1">
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
                <span>LIVE FEED</span>
              </div>
              <button 
                onClick={handleSwitchCamera}
                className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/60 transition-colors"
                title="Switch Camera"
              >
                <RefreshCw size={18} />
              </button>
            </>
          )}
          <div className="absolute bottom-4 left-4 flex flex-col space-y-1">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
              <span className="text-[10px] text-white font-bold drop-shadow-md uppercase tracking-wider">
                {status}
              </span>
            </div>
            {isConnected && (
              <div className="flex items-center space-x-1 text-[8px] text-white/70 font-bold uppercase tracking-widest">
                <div className="w-1 h-1 bg-white/50 rounded-full" />
                <span>Knowledge Base Active</span>
              </div>
            )}
          </div>
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
          <div className="p-4 bg-white border-t border-gray-100 space-y-4">
            <form onSubmit={handleSendText} className="flex items-center space-x-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-gray-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-gray-400 transition-all"
              >
                <MessageSquare size={18} />
              </button>
            </form>

            <div className="flex items-center justify-center space-x-8">
              <div className="flex flex-col items-center space-y-1">
                <button 
                  onClick={toggleRecording}
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${
                    isRecording 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  {isRecording ? 'Mute' : 'Unmute'}
                </span>
              </div>

              <div className="flex flex-col items-center space-y-1">
                <button 
                  onClick={toggleCamera}
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${
                    isCameraOn 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                >
                  {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  {isCameraOn ? 'Cam On' : 'Cam Off'}
                </span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
