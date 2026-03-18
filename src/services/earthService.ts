import { GoogleGenAI } from "@google/genai";
import { SoilData, ForecastData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const earthService = {
  async getForecast(groundTruth: SoilData): Promise<ForecastData> {
    const { latitude, longitude } = groundTruth.location || { latitude: 0, longitude: 0 };
    
    const prompt = `
      You are the "Google Alfa Earth" Foundation Model, providing "sky truth" intelligence for agriculture.
      
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

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
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
    } catch (error) {
      console.error("Alfa Earth Error:", error);
      throw new Error("Failed to fetch sky truth from Alfa Earth.");
    }
  }
};
