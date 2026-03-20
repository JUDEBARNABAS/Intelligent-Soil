import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { UgandanLanguage, SoilData, ForecastData } from '../types';
import { sunbirdService } from '../services/sunbirdService';
import { db, collection, onSnapshot, query, orderBy } from '../firebase';

export const useGeminiLive = (apiKey: string, groundTruth?: SoilData | null, skyTruth?: ForecastData | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [targetLanguage, setTargetLanguage] = useState<UgandanLanguage>('en');
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string, translatedText?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Offline');
  const [customKnowledge, setCustomKnowledge] = useState<string>('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  // Fetch custom knowledge base
  useEffect(() => {
    const q = query(collection(db, 'knowledge_base'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const knowledge = snapshot.docs.map(doc => {
        const data = doc.data();
        let entry = `TOPIC: ${data.title}\n`;
        if (data.content) entry += `CONTENT: ${data.content}\n`;
        if (data.fileName) entry += `ATTACHED FILE: ${data.fileName} (${data.fileType})\n`;
        if (data.fileUrl) entry += `FILE URL: ${data.fileUrl}\n`;
        return entry;
      }).join('\n\n');
      setCustomKnowledge(knowledge);
    });
    return unsubscribe;
  }, []);

  const connect = useCallback(async (retryCount = 0) => {
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const groundTruthInfo = groundTruth ? `
        GROUND TRUTH (Soil Sensor Data):
        - Temperature: ${groundTruth.temperature}°C
        - Humidity: ${groundTruth.humidity}%
        - pH: ${groundTruth.ph}
        - Nitrogen: ${groundTruth.nitrogen} mg/kg
        - Phosphorus: ${groundTruth.phosphorus} mg/kg
        - Potassium: ${groundTruth.potassium} mg/kg
        - Conductivity: ${groundTruth.conductivity} mS/cm
        - Overall Fertility: ${groundTruth.fertility}%
        - Location: Lat ${groundTruth.location?.latitude}, Lon ${groundTruth.location?.longitude}
      ` : "No ground truth soil data available yet.";

      const skyTruthInfo = skyTruth ? `
        SKY TRUTH (Satellite & Weather Intelligence):
        - Yield Forecast: ${skyTruth.yieldForecast}
        - Weather Forecast: ${skyTruth.weatherForecast}
        - Agroecological Recommendations: ${skyTruth.agroecologicalRecommendations}
      ` : "No sky truth satellite/weather data available yet.";

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setStatus('Connected & Ready');
            setError(null);
          },
          onmessage: async (message: LiveServerMessage) => {
            const serverContent = message.serverContent as any;
            const modelTurn = serverContent?.modelTurn;
            const userTurn = serverContent?.userTurn;

            if (modelTurn) setStatus('Agronomist is speaking...');
            if (userTurn) setStatus('Listening to you...');
            
            // Handle model response (transcription and audio)
            if (modelTurn?.parts) {
              for (const part of modelTurn.parts) {
                if (part.text) {
                  const originalText = part.text;
                  let translatedText = originalText;

                  if (targetLanguage !== 'en') {
                    try {
                      translatedText = await sunbirdService.translate(originalText, 'en', targetLanguage);
                      const sunbirdAudio = await sunbirdService.textToSpeech(translatedText, targetLanguage);
                      if (sunbirdAudio) {
                        playAudio(sunbirdAudio, 24000);
                      }
                    } catch (e) {
                      console.error('Translation error:', e);
                    }
                  }

                  setTranscript(prev => [...prev, { 
                    role: 'model', 
                    text: originalText,
                    translatedText: targetLanguage !== 'en' ? translatedText : undefined
                  }]);
                }

                if (part.inlineData?.data && targetLanguage === 'en') {
                  playAudio(part.inlineData.data, 24000);
                }
              }
            }

            // Handle user input transcription
            if (userTurn?.parts) {
              for (const part of userTurn.parts) {
                if (part.text) {
                  setTranscript(prev => [...prev, { 
                    role: 'user', 
                    text: part.text
                  }]);
                }
              }
            }
          },
          onclose: () => {
            setIsConnected(false);
            setStatus('Disconnected');
            stopRecording();
            stopCamera();
          },
          onerror: (err) => {
            console.error('Live error:', err);
            setError(err.message);
            setStatus('Connection Error');
            setIsConnected(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `
            You are the Intelligent Soil Agronomist. Your goal is to help field operators and farmers optimize their soil health and crop yields, specifically focusing on Sunflowers and other regional crops.
            
            KNOWLEDGE BASE:
            - SKY TRUTH: Satellite intelligence and weather forecasting.
            - GROUND TRUTH: Real-time soil sensor data (NPK, pH, Moisture, Temp).
            
            ${groundTruthInfo}
            
            ${skyTruthInfo}
            
            CUSTOM EXPERT KNOWLEDGE:
            ${customKnowledge || "No custom expert knowledge added yet."}
            
            SUNFLOWER MODEL:
            - Sunflowers need well-drained soil with pH 6.0-7.5.
            - High Nitrogen is needed during vegetative growth, but excess can reduce oil content.
            - Phosphorus is critical for root development and flowering.
            - Potassium improves drought resistance and stem strength.
            
            You can see the user's camera feed. Use it to identify plant stress, pests (like sunflower beetles), or soil texture.
            Be concise, professional, and encouraging. Respond in English. 
            Always refer to the ground truth and sky truth data when providing advice.
          `,
        },
      });
      
      sessionRef.current = session;
    } catch (err: any) {
      console.error('Connection error:', err);
      if (err.message?.includes('429') && retryCount < 3) {
        setError(`Rate limited. Retrying (${retryCount + 1}/3)...`);
        setTimeout(() => connect(retryCount + 1), 2000 * (retryCount + 1));
      } else {
        setError(err.message || "Failed to connect to agronomist");
      }
    }
  }, [apiKey, targetLanguage, groundTruth, skyTruth, customKnowledge]);

  const startRecording = async () => {
    if (!isConnected || !sessionRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        sessionRef.current.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsRecording(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
  };

  const startCamera = async (videoElement: HTMLVideoElement, mode?: 'user' | 'environment') => {
    if (!isConnected || !sessionRef.current) {
      setError("Please connect first");
      return;
    }

    const modeToUse = mode || facingMode;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: modeToUse,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      cameraStreamRef.current = stream;
      videoElement.srcObject = stream;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);

      videoIntervalRef.current = window.setInterval(() => {
        if (!ctx || !videoElement || !sessionRef.current) return;
        
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0);
        
        const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        sessionRef.current.sendRealtimeInput({
          video: { data: base64Data, mimeType: 'image/jpeg' }
        });
      }, 1000);

      setIsCameraOn(true);
      setFacingMode(modeToUse);
    } catch (err: any) {
      console.error('Camera error:', err);
      setError(`Camera error: ${err.message}`);
    }
  };

  const switchCamera = async (videoElement: HTMLVideoElement) => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    if (isCameraOn) {
      stopCamera();
      // Small delay to allow camera to release
      setTimeout(() => startCamera(videoElement, newMode), 500);
    } else {
      setFacingMode(newMode);
    }
  };

  const sendTextMessage = (text: string) => {
    if (!isConnected || !sessionRef.current) return;
    sessionRef.current.sendRealtimeInput({
      text: text
    });
    setTranscript(prev => [...prev, { role: 'user', text }]);
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    setIsCameraOn(false);
  };

  const playAudio = (base64Data: string, sampleRate: number = 24000) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate });
    }
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcmData = new Int16Array(bytes.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 0x7FFF;
    }
    
    const buffer = audioContextRef.current.createBuffer(1, floatData.length, sampleRate);
    buffer.getChannelData(0).set(floatData);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  const disconnect = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopRecording();
    stopCamera();
  };

  return {
    isConnected,
    isRecording,
    isCameraOn,
    facingMode,
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
  };
};
