import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ──────────────────────────────────────────────
// SETUP DIRECTORIES
// ──────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ──────────────────────────────────────────────
// ENV LOADING
// ──────────────────────────────────────────────

console.log('=== MindSync AI Startup ===');

let envPath = path.join(__dirname, '.env');
let envFound = false;

if (fs.existsSync(envPath)) {
  envFound = true;
  console.log(`Found .env file: ${envPath}`);
} else {
  dotenv.config();
}

if (envFound) {
  dotenv.config({ path: envPath });
}

// ──────────────────────────────────────────────
// API KEY
// ──────────────────────────────────────────────

const apiKey = (process.env.GROQ_API_KEY || '').trim();

if (!apiKey) {
  console.error('❌ GROQ_API_KEY is missing');
} else {
  console.log('✅ GROQ_API_KEY loaded successfully');
}

// ──────────────────────────────────────────────
// GROQ CLIENT
// ──────────────────────────────────────────────

const groq = new Groq({
  apiKey
});

// Use ONE model only.
// Do not add llama-3.1-8b-instant as fallback.
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ──────────────────────────────────────────────
// EXPRESS APP
// ──────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  })
);

app.use(express.json({ limit: '2mb' }));

// ──────────────────────────────────────────────
// RATE LIMITING
// ──────────────────────────────────────────────

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    error: 'Too many requests. Please try again after 15 minutes.'
  }
});

app.use('/api/', limiter);

// ──────────────────────────────────────────────
// ZOD SCHEMAS
// ──────────────────────────────────────────────

const FlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1)
});

const QuizQuestionSchema = z.object({
  question: z.string().min(1),

  options: z
    .array(z.string())
    .min(2)
    .max(6),

  correctAnswer: z.string().min(1),

  explanation: z.string().min(1)
});

const StudyMaterialSchema = z.object({
  flashcards: z
    .array(FlashcardSchema)
    .min(1),

  quiz: z
    .array(QuizQuestionSchema)
    .min(1)
});

// ──────────────────────────────────────────────
// PROMPT GENERATION
// ──────────────────────────────────────────────

function generatePrompt(notes) {
  return `
You are MindSync AI, an intelligent AI-powered study assistant.

Your task is to analyze the student's study notes and create:

1. Flashcards for active recall.
2. Multiple-choice quiz questions for knowledge testing.

STUDY NOTES:
"""
${notes}
"""

You MUST return ONLY a valid JSON object.

Use exactly this structure:

{
  "flashcards": [
    {
      "front": "Question or important term",
      "back": "Clear and concise answer or explanation"
    }
  ],
  "quiz": [
    {
      "question": "Multiple-choice question",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "correctAnswer": "Exact correct option text",
      "explanation": "Brief explanation of why the answer is correct"
    }
  ]
}

IMPORTANT RULES:

- Generate between 4 and 8 flashcards.
- Generate between 4 and 6 quiz questions.
- Every quiz question must have useful answer options.
- correctAnswer MUST exactly match one option.
- Return ONLY JSON.
- Do NOT return markdown.
- Do NOT use \`\`\`json.
- Do NOT add explanations before or after the JSON.
`;
}

// ──────────────────────────────────────────────
// CLEAN AI RESPONSE
// ──────────────────────────────────────────────

function cleanJsonResponse(rawText) {
  let cleaned = rawText.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

// ──────────────────────────────────────────────
// GENERATE STUDY MATERIAL USING GROQ
// ──────────────────────────────────────────────

async function generateStudyMaterial(notes) {
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  console.log(`🤖 Generating study material using: ${GROQ_MODEL}`);

  const response = await Promise.race([
    groq.chat.completions.create({
      model: GROQ_MODEL,

      messages: [
        {
          role: 'system',
          content:
            'You are MindSync AI. Return only valid JSON. Never return markdown or additional text.'
        },
        {
          role: 'user',
          content: generatePrompt(notes)
        }
      ],

      temperature: 0.5,
      max_tokens: 4096,

      response_format: {
        type: 'json_object'
      }
    }),

    new Promise((_, reject) =>
      setTimeout(() => {
        reject(new Error('TIMEOUT'));
      }, 30000)
    )
  ]);

  const text = response.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('EMPTY_RESPONSE');
  }

  console.log('✅ Groq generation successful');

  return cleanJsonResponse(text);
}

// ──────────────────────────────────────────────
// API ROUTE
// ──────────────────────────────────────────────

app.post('/api/generate', async (req, res) => {
  const { notes } = req.body;

  // Validate notes
  if (
    !notes ||
    typeof notes !== 'string' ||
    notes.trim().length < 10
  ) {
    return res.status(400).json({
      error:
        'Please provide valid study notes with at least 10 characters.'
    });
  }

  try {
    // Generate AI response
    const rawJson = await generateStudyMaterial(notes);

    // Convert string to JavaScript object
    const parsedData = JSON.parse(rawJson);

    // Validate structure
    const validatedData =
      StudyMaterialSchema.parse(parsedData);

    // Send response to frontend
    return res.status(200).json(validatedData);

  } catch (error) {
    console.error(
      '❌ Generation Error:',
      error.message
    );

    // Missing API key
    if (error.message === 'API_KEY_MISSING') {
      return res.status(500).json({
        error:
          'Groq API key is missing. Add GROQ_API_KEY in Vercel Environment Variables.'
      });
    }

    // Timeout
    if (error.message === 'TIMEOUT') {
      return res.status(504).json({
        error:
          'Request timed out. Please try again with shorter notes.'
      });
    }

    // Empty response
    if (error.message === 'EMPTY_RESPONSE') {
      return res.status(500).json({
        error:
          'The AI returned an empty response. Please try again.'
      });
    }

    // Zod validation error
    if (error instanceof z.ZodError) {
      return res.status(422).json({
        error:
          'AI response did not match the expected study material format.',
        details: error.errors
      });
    }

    // Invalid JSON
    if (error instanceof SyntaxError) {
      return res.status(422).json({
        error:
          'AI returned invalid JSON. Please try again.'
      });
    }

    // Generic error
    return res.status(500).json({
      error:
        `Failed to generate study materials: ${error.message}`
    });
  }
});

// ──────────────────────────────────────────────
// HEALTH CHECK
// ──────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    provider: 'groq',
    model: GROQ_MODEL,
    keyConfigured: !!apiKey
  });
});

// ──────────────────────────────────────────────
// ROOT ROUTE
// ──────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    message: 'MindSync AI Backend is running 🚀',
    provider: 'Groq',
    model: GROQ_MODEL
  });
});

// ──────────────────────────────────────────────
// SERVER STARTUP
// ──────────────────────────────────────────────

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(
      `🚀 Server running on http://localhost:${PORT}`
    );

    console.log(
      `❤️ Health check: http://localhost:${PORT}/health`
    );
  });
}

// Export for Vercel
export default app;