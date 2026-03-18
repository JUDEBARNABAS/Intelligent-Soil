import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { UgandanLanguage, SoilData, ForecastData } from '../types';
import { sunbirdService } from '../services/sunbirdService';

export const useGeminiLive = (apiKey: string, groundTruth?: SoilData | null, skyTruth?: ForecastData | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<UgandanLanguage>('en');
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string, translatedText?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  const connect = useCallback(async () => {
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
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setError(null);
          },
          onmessage: async (message: LiveServerMessage) => {
            const modelTurn = message.serverContent?.modelTurn;
            if (modelTurn?.parts[0]?.text) {
              const originalText = modelTurn.parts[0].text;
              let translatedText = originalText;

              if (targetLanguage !== 'en') {
                translatedText = await sunbirdService.translate(originalText, 'en', targetLanguage);
                const sunbirdAudio = await sunbirdService.textToSpeech(translatedText, targetLanguage);
                if (sunbirdAudio) {
                  playAudio(sunbirdAudio, 24000); // Sunbird TTS usually 24kHz or similar
                }
              }

              setTranscript(prev => [...prev, { 
                role: 'model', 
                text: originalText,
                translatedText: targetLanguage !== 'en' ? translatedText : undefined
              }]);
            }
            
            const base64Audio = modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && targetLanguage === 'en') {
              playAudio(base64Audio, 24000);
            }
          },
          onclose: () => {
            setIsConnected(false);
            stopRecording();
            stopCamera();
          },
          onerror: (err) => {
            setError(err.message);
            setIsConnected(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `
            You are an expert agronomist. Help the user understand their soil sensor data and provide advice on crop management, fertilization, and soil health. 
            
            ${groundTruthInfo}
            
            ${skyTruthInfo}
            
            You can see the user's camera feed, so use it to identify plants, pests, or soil conditions. 
            Be concise and professional. Respond in English. 
            Always refer to the ground truth and sky truth data when providing advice.
          `,
        },
      });
      
      sessionRef.current = session;
    } catch (err: any) {
      setError(err.message);
    }
  }, [apiKey, targetLanguage, groundTruth, skyTruth]);

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
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
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

  const startCamera = async (videoElement: HTMLVideoElement) => {
    if (!isConnected || !sessionRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, frameRate: 5 } 
      });
      cameraStreamRef.current = stream;
      videoElement.srcObject = stream;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      videoIntervalRef.current = window.setInterval(() => {
        if (!ctx || !videoElement) return;
        
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0);
        
        const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'image/jpeg' }
        });
      }, 1000); // Send 1 frame per second

      setIsCameraOn(true);
    } catch (err: any) {
      setError(err.message);
    }
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
  };
};
