import { SITE_URL } from '@/constants/matric';
import { QuizQuestion } from '@/services/questions';

export interface GenerateExplanationResult {
  success: boolean;
  explanation?: string;
  message?: string;
}

/**
 * POST generate-explanation API.
 * Expects `{ success, explanation }` per app.md.
 */
export async function generateExplanation(
  question: QuizQuestion
): Promise<GenerateExplanationResult> {
  const endpoints = [
    `${SITE_URL}/api/explanation`,
    `${SITE_URL}/api/questions/explanation`,
  ];

  let lastError = 'Could not generate an explanation. Please try again.';

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          question: question.question,
          context: question.context,
          options: question.options,
          answer: question.answer,
          subject: question.name,
          topic: question.topic,
        }),
      });

      if (!response.ok) {
        lastError = `Could not generate an explanation (${response.status}). Please try again.`;
        continue;
      }

      const data = (await response.json()) as {
        success?: boolean;
        explanation?: string;
        message?: string;
      };

      if (data.success && data.explanation?.trim()) {
        return { success: true, explanation: data.explanation.trim() };
      }

      lastError = data.message || lastError;
    } catch (error) {
      console.error('Generate explanation failed:', url, error);
      lastError = 'Could not generate an explanation. Please try again.';
    }
  }

  return { success: false, message: lastError };
}
