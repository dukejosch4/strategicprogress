import { GoogleGenAI } from "@google/genai";

// NOTE: In a production app, never expose the API KEY in the client code directly if possible.
// This is for the requested implementation.
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getStrategicInsight = async (context: string, data: any) => {
  if (!process.env.API_KEY) return "API Key not configured.";

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a high-performance athletic and business coach.
      Analyze the following data for the context: ${context}.
      Provide a concise, bulleted strategic advice summary (max 100 words) to maximize performance.
      
      Data: ${JSON.stringify(data)}`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Unable to generate insights at this time.";
  }
};