/**
 * AI Service Module
 * Handles integration with Google Generative AI API for AI-powered features
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Session storage for API key (volatile - cleared on refresh/tab close)
let sessionApiKey: string | null = null;

/**
 * Set the API key for the current session
 * Key is stored in memory only and will be cleared on page refresh
 */
export const setSessionApiKey = (key: string): void => {
    sessionApiKey = key;
};

/**
 * Get the current session API key
 */
export const getSessionApiKey = (): string | null => {
    return sessionApiKey;
};

/**
 * Clear the session API key
 */
export const clearSessionApiKey = (): void => {
    sessionApiKey = null;
};

/**
 * Check if AI features are available (API key is set)
 */
export const isAiAvailable = (): boolean => {
    return sessionApiKey !== null && sessionApiKey.length > 0;
};

/**
 * Test the API key with a simple hello world call
 * Returns { success: true } on success or { success: false, error: string } on failure
 */
export const testApiKey = async (apiKey: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const result = await model.generateContent('Hello, respond with just "AI Ready"');
        const response = await result.response;
        const text = response.text();

        if (text && text.length > 0) {
            return { success: true };
        } else {
            return { success: false, error: 'Empty response from API' };
        }
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || 'Failed to connect to Google AI'
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
    if (!sessionApiKey) {
        return { answers: [], error: 'No API key set' };
    }

    try {
        const genAI = new GoogleGenerativeAI(sessionApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

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
        const text = response.text();

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
