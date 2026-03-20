import { GoogleGenAI } from "@google/genai";
import { SoilData, ForecastData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const earthService = {
  async getForecast(groundTruth: SoilData, retries = 3): Promise<ForecastData> {
    const { latitude, longitude } = groundTruth.location || { latitude: 0, longitude: 0 };
    
    const prompt = `
      You are the "Soil and weather intelligence" Foundation Model, providing "sky truth" intelligence for agriculture.
      
      GROUND TRUTH (Soil Sensor Data at Lat: ${latitude}, Lon: ${longitude}):
      - Temperature: ${groundTruth.temperature}°C
      - Humidity: ${groundTruth.humidity}%
      - pH: ${groundTruth.ph}
      - Nitrogen: ${groundTruth.nitrogen} mg/kg
      - Phosphorus: ${groundTruth.phosphorus} mg/kg
      - Potassium: ${groundTruth.potassium} mg/kg
      - Conductivity: ${groundTruth.conductivity} mS/cm
      - Overall Fertility: ${groundTruth.fertility}%
      
      SKY TRUTH (Your Task):
      1. Use Google Search to find current and seasonal weather trends, satellite-derived NDVI (Vegetation Index), and soil moisture trends for the location (Lat: ${latitude}, Lon: ${longitude}).
      2. Combine this "sky truth" with the provided "ground truth" soil data.
      3. Forecast yield potential for common crops in this region.
      4. Provide a 7-day weather forecast relevant to farming (rain, heat, wind).
      5. Provide specific agroecological recommendations (e.g., cover cropping, specific fertilizer timing based on rain, pest risks).
      
      Format your response as a JSON object with the following structure:
      {
        "yieldForecast": "Detailed yield forecast string",
        "weatherForecast": "Detailed weather forecast string",
        "agroecologicalRecommendations": "Detailed recommendations string",
        "skyTruthSource": ["URL1", "URL2", ...]
      }
    `;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-preview",
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json"
          }
        });

        const result = JSON.parse(response.text || '{}');
        
        return {
          yieldForecast: result.yieldForecast || "Unable to generate yield forecast at this time.",
          weatherForecast: result.weatherForecast || "Unable to generate weather forecast at this time.",
          agroecologicalRecommendations: result.agroecologicalRecommendations || "Unable to generate recommendations at this time.",
          skyTruthSource: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => chunk.web?.uri).filter(Boolean) || [],
          timestamp: Date.now()
        };
      } catch (error: any) {
        const errorString = JSON.stringify(error).toLowerCase();
        const isRateLimit = 
          errorString.includes('429') || 
          errorString.includes('resource_exhausted') || 
          errorString.includes('quota exceeded') ||
          error?.status === 429 ||
          error?.code === 429;
        
        if (isRateLimit && i < retries - 1) {
          const delay = Math.pow(2, i) * 3000; // Exponential backoff: 3s, 6s, 12s
          console.warn(`Soil and weather intelligence Rate Limit (429). Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
          await sleep(delay);
          continue;
        }

        console.error("Soil and weather intelligence Error:", error);
        throw new Error(isRateLimit 
          ? "Soil and weather intelligence is currently busy (Rate Limit). Please try again in a few moments." 
          : "Failed to fetch sky truth from Soil and weather intelligence.");
      }
    }
    
    throw new Error("Failed to fetch sky truth after multiple attempts.");
  }
};
