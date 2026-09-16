
import { GoogleGenAI, Type } from "@google/genai";
import { getSettings } from "./storageService";

const getClient = () => {
  const settings = getSettings();
  
  // Check Global AI Toggle
  if (!settings.enableAI) {
      return null;
  }

  // Priority: User Settings > Environment Variable
  const apiKey = settings.apiKey || process.env.API_KEY;
  
  if (!apiKey) {
    console.warn("API_KEY is not set in settings or process.env");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// Feature 1: Break down tasks
export const suggestSubtasks = async (taskTitle: string, taskDescription: string): Promise<string[]> => {
  const client = getClient();
  if (!client) return []; // Silent fail if disabled

  try {
    const prompt = `
      You are a project management assistant. 
      Break down the following task into 3 to 5 actionable, concise subtasks.
      Task Title: "${taskTitle}"
      Task Description: "${taskDescription}"
      
      Return ONLY a list of strings representing the subtasks.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) return [];
    
    return JSON.parse(jsonStr) as string[];
  } catch (error) {
    console.error("Error generating subtasks:", error);
    // Return empty array to indicate failure without crashing UI
    return [];
  }
};

// Feature 2: Enhance Description
export const enhanceTaskDescription = async (taskTitle: string, currentDescription: string): Promise<string> => {
    const client = getClient();
    if (!client) return "";

    try {
        const prompt = `
          You are a professional project manager.
          Rewrite and expand the following task description to be more professional, clear, and actionable.
          Include a brief "Objective" and "Key Requirements" section.
          Keep it under 150 words.
          
          Task Title: "${taskTitle}"
          Current Draft: "${currentDescription}"
        `;

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "";
    } catch (error) {
        console.error("Error enhancing description:", error);
        return "";
    }
}
