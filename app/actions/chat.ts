'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY || '');

export async function sendChatMessage(
  message: string,
  tutorMode: boolean,
  courseId?: number,
  courseNickname?: string
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google AI API key is not configured');
    }
    
    // Validate API key format (should start with AIza and be ~39 chars)
    if (!apiKey.startsWith('AIza') || apiKey.length < 35) {
      throw new Error('API key format appears invalid. Google AI API keys should start with "AIza" and be approximately 39 characters long.');
    }

    // Based on available models: Gemini 3 Flash Preview first, then fallbacks
    // Try models in order: Gemini 3 Flash Preview -> Gemini 2.5 Flash -> Gemini 2.0 Flash, etc.
    const modelNames = [
      'gemini-3-flash',        // Gemini 3 Flash Preview - try first
      'gemini-3.0-flash',      // Gemini 3 Flash Preview (alternative format)
      'gemini-2.5-flash',      // Gemini 2.5 Flash - stable fallback
      'gemini-2.5-pro',        // Gemini 2.5 Pro
      'gemini-2.0-flash',      // Gemini 2.0 Flash - most stable
      'gemini-3-pro',          // Gemini 3 Pro Preview
      'gemini-1.5-flash',      // Fallback
      'gemini-1.5-pro'         // Fallback
    ];
    
    let model;
    let modelName = modelNames[0];
    
    // Initialize with first model (errors only occur on generateContent)
    model = genAI.getGenerativeModel({ model: modelName });

    let systemPrompt = '';
    
    if (courseId && courseNickname) {
      // Course-specific assistant
      const courseContext = `You are the ${courseNickname} Junior Assistant for a BYU Accounting student. You specialize in helping with ${courseNickname} coursework.`;
      
      if (tutorMode) {
        systemPrompt = `${courseContext} Tutor Mode is ON. Do not give direct answers. Instead, ask Socratic questions to help the student find the answer themselves using GAAP principles and ${courseNickname} concepts. Guide them through their thinking process step by step.`;
      } else {
        systemPrompt = `${courseContext} Tutor Mode is OFF. Give concise, professional accounting explanations related to ${courseNickname}. Be helpful and clear while maintaining academic rigor.`;
      }
    } else {
      // General assistant
      if (tutorMode) {
        systemPrompt = 'You are the Junior Ledger Assistant for a BYU Accounting student. Tutor Mode is ON. Do not give direct answers. Instead, ask Socratic questions to help the student find the answer themselves using GAAP principles. Guide them through their thinking process step by step.';
      } else {
        systemPrompt = 'You are the Junior Ledger Assistant for a BYU Accounting student. Tutor Mode is OFF. Give concise, professional accounting explanations. Be helpful and clear while maintaining academic rigor.';
      }
    }

    const prompt = `${systemPrompt}\n\nStudent: ${message}\n\nAssistant:`;

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (modelError: any) {
      // If the model doesn't exist, try other available models
      if (modelError?.message?.includes('not found') || modelError?.message?.includes('404')) {
        console.log(`Model ${modelName} not found, trying alternatives...`);
        
        // Try other models from the list
        for (const altName of modelNames) {
          if (altName === modelName) continue;
          try {
            const altModel = genAI.getGenerativeModel({ model: altName });
            result = await altModel.generateContent(prompt);
            console.log(`Successfully used model: ${altName}`);
            break;
          } catch (altErr) {
            continue;
          }
        }
        
        if (!result) {
          throw new Error(`No available models found. Available models in your account: Gemini 2.0 Flash, Gemini 2.5 Flash, Gemini 2.5 Pro, etc. Please check Google AI Studio for the exact model identifier.`);
        }
      } else {
        throw modelError;
      }
    }
    
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      // Quota/Rate limit errors
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Quota exceeded')) {
        const retryMatch = error.message.match(/Please retry in ([\d.]+)s/);
        const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
        
        let message = 'You\'ve exceeded your free tier quota for the Gemini API. ';
        if (retrySeconds) {
          message += `Please wait ${retrySeconds} seconds and try again. `;
        }
        message += 'For more information, visit https://ai.google.dev/gemini-api/docs/rate-limits or check your usage at https://ai.dev/usage';
        
        throw new Error(message);
      }
      
      // API key errors
      if (error.message.includes('API key not valid') || error.message.includes('API_KEY_INVALID')) {
        throw new Error('Invalid API key. Please check your GOOGLE_GENERATIVE_AI_API_KEY (or GOOGLE_AI_API_KEY) in .env.local and ensure it\'s correct. Get a new key from https://aistudio.google.com/apikey');
      }
      if (error.message.includes('API key not found')) {
        throw new Error('API key not found. Please set GOOGLE_GENERATIVE_AI_API_KEY (or GOOGLE_AI_API_KEY) in your .env.local file.');
      }
      
      // Model not found errors
      if (error.message.includes('not found') || error.message.includes('404')) {
        throw new Error(`Model not available. ${error.message}`);
      }
      
      throw new Error(`API Error: ${error.message}`);
    }
    
    throw new Error('Failed to get response from AI assistant. Please check your API key and try again.');
  }
}
