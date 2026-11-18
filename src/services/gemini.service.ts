
import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL = 'gemini-3.8-flash';

const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;


  export async function generateAIResponse(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
  
    const maxAttempts = 3;
    const retryableStatuses = [429, 500, 502, 503, 504];
  
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(30000),
      });
  
      if (response.ok) {
        const result = await response.json() as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };
  
        const generatedText = result.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? '')
          .join('')
          .trim();
  
        if (!generatedText) {
          throw new Error('Gemini returned an empty response');
        }
  
        return generatedText;
      }
  
      const errorDetails = await response.text();
  
      if (
        !retryableStatuses.includes(response.status) ||
        attempt === maxAttempts
      ) {
        throw new Error(
          `Gemini API request failed (${response.status}): ${errorDetails}`,
        );
      }
  
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * 2 ** (attempt - 1)),
      );
    }
  
    throw new Error('Gemini request failed after all retry attempts');
  }
  