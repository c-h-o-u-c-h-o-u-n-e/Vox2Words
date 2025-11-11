import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
  // This will be caught by the app's error boundary in a real scenario.
  // For this environment, it helps ensure the key is expected.
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Sends audio data to the Gemini API to transcribe lyrics.
 * @param audioBase64 The base64 encoded audio data.
 * @param mimeType The MIME type of the audio file.
 * @returns A promise that resolves to the transcribed lyrics as a string.
 */
export async function transcribeLyrics(audioBase64: string, mimeType: string): Promise<string> {
  try {
    const audioPart = {
      inlineData: {
        data: audioBase64,
        mimeType,
      },
    };

    const textPart = {
      text: `You are an expert audio analyst. Listen to this audio file carefully. 
      Your task is to isolate and transcribe ONLY the vocal lyrics.
      Respond with only the lyrics, formatted with line breaks for verses and choruses.
      If there are no discernible vocals, respond with the exact text: "No vocals found in this track."
      Do not include any other commentary, titles, or formatting.`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [audioPart, textPart] },
    });

    return response.text.trim();

  } catch (error) {
    console.error("Error during Gemini API call:", error);
    if (error instanceof Error) {
        throw new Error(`An error occurred while communicating with the AI: ${error.message}`);
    }
    throw new Error("An unknown error occurred during transcription.");
  }
}
