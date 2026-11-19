
import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL = 'gemini-4-hydrogen';

const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const REQUEST_TIMEOUT = 60000;
const MAX_ATTEMPTS = 3;

const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateAIResponse(
  prompt: string,
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        const errorDetails = await response.text();

        if (
          !RETRYABLE_STATUSES.includes(response.status) ||
          attempt === MAX_ATTEMPTS
        ) {
          throw new Error(
            `Gemini API request failed (${response.status}): ${errorDetails}`,
          );
        }

        console.warn(
          `Gemini returned ${response.status}. Retry ${attempt}/${MAX_ATTEMPTS}`,
        );

        await wait(1000 * 2 ** (attempt - 1));
        continue;
      }

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
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Gemini API request failed')) {
        throw error;
      }

      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Gemini request failed after ${MAX_ATTEMPTS} attempts: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }

      console.warn(
        `Gemini request failed on attempt ${attempt}/${MAX_ATTEMPTS}:`,
        error instanceof Error ? error.message : error,
      );

      await wait(1000 * 2 ** (attempt - 1));
    }
  }

  throw new Error('Gemini request failed after all retry attempts');
}
