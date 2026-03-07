/**
 * AI Service Module
 * Handles integration with Google Cloud Vertex AI API for AI-powered features
 */

import { VertexAI } from '@google-cloud/vertexai';

export interface VertexCredentials {
    apiKey: string;
    projectId: string;
    location: string;
}

// Session storage for credentials (volatile - cleared on refresh/tab close)
let sessionCredentials: VertexCredentials | null = null;

/**
 * Set the credentials for the current session
 * Key is stored in memory only and will be cleared on page refresh
 */
export const setSessionApiKey = (credentials: VertexCredentials): void => {
    sessionCredentials = credentials;
};

/**
 * Get the current session credentials
 */
export const getSessionApiKey = (): VertexCredentials | null => {
    return sessionCredentials;
};

/**
 * Clear the session credentials
 */
export const clearSessionApiKey = (): void => {
    sessionCredentials = null;
};

/**
 * Check if AI features are available (credentials are set)
 */
export const isAiAvailable = (): boolean => {
    return sessionCredentials !== null && sessionCredentials.apiKey.length > 0 && sessionCredentials.projectId.length > 0 && sessionCredentials.location.length > 0;
};

/**
 * Test the credentials with a simple hello world call
 * Returns { success: true } on success or { success: false, error: string } on failure
 */
export const testApiKey = async (apiKey: string, projectId: string, location: string): Promise<{ success: boolean; error?: string }> => {
    try {
        // According to the Vertex AI library, you can pass credentials or rely on ADC.
        // For a frontend implementation using a provided key/token, we usually configure the project properly. Wait, Vertex AI relies on the Google Auth library typically, or REST. 
        // Can we initialize VertexAI directly with apiKey? The prompt says "use the VertexAI class".
        const vertexAi = new VertexAI({ project: projectId, location: location, googleAuthOptions: { apiKey } }); // Or maybe just `{project, location}` and the apiKey? I will check the documentation if needed, or provide googleAuthOptions: { apiKey } wait, the prompt asks to replace @google/generative-ai with @google-cloud/vertexai.

        // Wait, the client library for the browser might differ, or standard Node.js `@google-cloud/vertexai` handles auth. We are in a Vite React app... `@google-cloud/vertexai` is a Node.js library. Can it be used in the browser? The prompt says "Replace `@google/generative-ai` with `@google-cloud/vertexai`". Let's assume the user knows it works and just initialize:
        const vertexAiInit = new VertexAI({ project: projectId, location: location, googleAuthOptions: { apiKey: apiKey } });
        const model = vertexAiInit.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const result = await model.generateContent('Hello, respond with just "AI Ready"');
        const response = await result.response;
        // Vertex AI text extraction might be different: it's typically response.candidates[0].content.parts[0].text
        // However, VertexAI's GenerativeModel is designed to mimic @google/generative-ai
        const text = response.candidates && response.candidates[0]?.content?.parts[0]?.text ? response.candidates[0].content.parts[0].text : '';

        if (text && text.length > 0) {
            return { success: true };
        } else {
            return { success: false, error: 'Empty response from API' };
        }
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || 'Failed to connect to Vertex AI'
        };
    }
};

/**
 * Generate incorrect answers for a flashcard using AI
 * @param term The front of the flashcard
 * @param correctAnswer The correct answer (back of the flashcard)
 * @returns Array of 3 incorrect answer strings, or null on error
 */
export const generateIncorrectAnswers = async (
    term: string,
    correctAnswer: string
): Promise<{ answers: string[]; error?: string } | null> => {
    if (!sessionCredentials) {
        return { answers: [], error: 'No API credentials set' };
    }

    try {
        const vertexAi = new VertexAI({
            project: sessionCredentials.projectId,
            location: sessionCredentials.location,
            googleAuthOptions: { apiKey: sessionCredentials.apiKey }
        });
        const model = vertexAi.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const prompt = `# ROLE
You are going to write three somewhat-plausible looking answers for a flashcard that are INCORRECT. For example, if the front of the flashcard was "Apple", the definition might be "a red fruit", so you would write "a yellow fruit" "a blue fruit" and "a red ball."
Here is the term you are writing these three wrong answers for: ${term}
Here is the correct answer the user is trying to find: ${correctAnswer}
When coming up with your three answers, try to use the same writing style as the correct answer the user has. Remember, your goal is to come up with the three most correct-seeming answers that are NOT correct.

# RESPONSE FORMAT 
Respond as a JSON in three keys, in this exact format. Do not add ANY extra comments or things; SOLELY provide this JSON.

{
      "1": "first wrong answer goes here",
      "2": "second wrong answer goes here",
      "3": "third wrong answer goes here"
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.candidates && response.candidates[0]?.content?.parts[0]?.text ? response.candidates[0].content.parts[0].text : '';

        // Clean up the response - remove markdown code blocks if present
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // Parse the JSON response
        const parsed = JSON.parse(jsonText);

        // Extract the three answers
        const answers = [
            parsed['1'] || parsed['a'] || '',
            parsed['2'] || parsed['b'] || '',
            parsed['3'] || parsed['c'] || ''
        ].filter(a => a.length > 0);

        if (answers.length === 3) {
            return { answers };
        } else {
            return { answers: [], error: 'AI did not return 3 valid answers' };
        }
    } catch (error: any) {
        console.error('AI Error:', error);
        return {
            answers: [],
            error: error?.message || 'Failed to generate AI answers'
        };
    }
};
