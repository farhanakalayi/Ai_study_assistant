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

// Setup directories
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ──────────────────────────────────────────────
// ENV LOADING
// ──────────────────────────────────────────────
console.log('=== MindSync Startup Diagnostics ===');
console.log(`CWD: ${process.cwd()}`);
console.log(`Module dir: ${__dirname}`);

let envPath = path.join(__dirname, '.env');
let envFound = false;
let fallbackUsed = false;

if (fs.existsSync(envPath)) {
  envFound = true;
  console.log(`Found .env: ${envPath}`);
} else {
  const rootEnvPath = path.join(path.dirname(__dirname), '.env');
  if (fs.existsSync(rootEnvPath)) {
    envPath = rootEnvPath;
    envFound = true;
    console.log(`Found .env in root: ${envPath}`);
  } else {
    console.log('.env not found in server/ or root.');
    const examplePath = path.join(__dirname, '.env.example');
    if (fs.existsSync(examplePath)) {
      const content = fs.readFileSync(examplePath, 'utf8');
      if (content.includes('GROQ_API_KEY=') && !content.includes('GROQ_API_KEY=your_groq_api_key_here')) {
        envPath = examplePath;
        envFound = true;
        fallbackUsed = true;
        console.log(`Fallback: loading from .env.example`);
      }
    }
  }
}

if (envFound) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// ──────────────────────────────────────────────
// API KEY VALIDATION
// ──────────────────────────────────────────────
const apiKey = (process.env.GROQ_API_KEY || '').trim();

if (!apiKey) {
  console.log('❌ GROQ_API_KEY: NOT FOUND');
} else if (apiKey === 'your_groq_api_key_here') {
  console.log('❌ GROQ_API_KEY: SET TO PLACEHOLDER');
} else {
  console.log(`✅ GROQ_API_KEY: FOUND (starts with "${apiKey.substring(0, 8)}...")`);
}

// ──────────────────────────────────────────────
// STARTUP SELF-TEST
// ──────────────────────────────────────────────
async function runSelfTest() {
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    console.log('⚠️  Self-test skipped: API key missing or placeholder.');
    return;
  }

  try {
    const groq = new Groq({ apiKey });
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: "Say 'Hello'" }],
      max_tokens: 10,
    });
    const text = response.choices?.[0]?.message?.content || '';
    console.log(`✅ Groq Self-Test passed! Response: "${text.trim()}"`);
  } catch (err) {
    console.error(`❌ Groq Self-Test failed: ${err.status || 'unknown'} — ${err.message}`);
  }
}

await runSelfTest();
console.log('====================================\n');

// ──────────────────────────────────────────────
// EXPRESS APP
// ──────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please try again after 15 minutes.' }
});
app.use('/api/', limiter);

// ──────────────────────────────────────────────
// ZOD SCHEMAS (unchanged from frontend contract)
// ──────────────────────────────────────────────
const FlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1)
});

const QuizQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).min(2).max(6),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(1)
});

const StudyMaterialSchema = z.object({
  flashcards: z.array(FlashcardSchema).min(1),
  quiz: z.array(QuizQuestionSchema).min(1)
});

// ──────────────────────────────────────────────
// PROMPT & HELPERS
// ──────────────────────────────────────────────
function generatePrompt(notes) {
  return `You are an expert AI Study Assistant.
Analyze the following study notes and generate two assets:
1. Flashcards for active recall.
2. A multiple-choice Quiz to test understanding.

Input Study Notes:
"""
${notes}
"""

You must respond ONLY with a raw, valid JSON object matching this schema:
{
  "flashcards": [
    {
      "front": "A clear, concise question or term",
      "back": "A concise explanation, answer, or definition"
    }
  ],
  "quiz": [
    {
      "question": "A clear multiple-choice question testing a core concept",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "The exact string from the options array that represents the correct answer",
      "explanation": "A helpful explanation of why this answer is correct and others are incorrect"
    }
  ]
}

Strict requirements:
- Do not include any markdown wrap like \`\`\`json or \`\`\`.
- Return ONLY the JSON object. No explanation, prefix, or suffix text.
- Do not use control characters or malformed JSON syntax.
- Ensure "correctAnswer" matches one of the values in "options" exactly.
- Generate between 4 to 8 flashcards and 4 to 6 quiz questions depending on the depth of the notes.`;
}

function cleanJsonResponse(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

// ──────────────────────────────────────────────
// GROQ GENERATION WITH MODEL FALLBACK
// ──────────────────────────────────────────────
async function callGroq(notes, forceCorrection = false, previousError = '') {
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error('API_KEY_MISSING');
  }

  const groq = new Groq({ apiKey });
  const modelsToTry = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`🤖 Generating with model: ${modelName}`);

      let prompt = generatePrompt(notes);
      if (forceCorrection) {
        prompt += `\n\nCRITICAL: Your previous response failed validation with the error: "${previousError}".
Please ensure that you output strictly valid JSON conforming exactly to the schema requested, without markdown formatting or surrounding text.`;
      }

      const response = await Promise.race([
        groq.chat.completions.create({
          model: modelName,
          messages: [
            {
              role: 'system',
              content: 'You are an AI study assistant. You MUST respond with ONLY valid JSON. No markdown, no explanation, no surrounding text.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 30000))
      ]);

      const text = response.choices?.[0]?.message?.content;
      if (!text) throw new Error('EMPTY_RESPONSE');

      console.log(`✅ Generation succeeded with ${modelName}`);
      return cleanJsonResponse(text);

    } catch (err) {
      const msg = err.message || '';
      console.warn(`⚠️ Model ${modelName} failed: ${msg}`);
      lastError = err;

      // Fatal errors — don't try next model
      if (err.status === 401 || msg.includes('invalid_api_key')) {
        throw new Error('API_KEY_INVALID');
      }
      if (err.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      if (msg === 'TIMEOUT') {
        throw err;
      }
    }
  }

  throw lastError || new Error('All models failed');
}

// ──────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { notes } = req.body;

  if (!notes || typeof notes !== 'string' || notes.trim().length < 10) {
    return res.status(400).json({ error: 'Please provide valid study notes (minimum 10 characters).' });
  }

  let isAborted = false;
  req.on('close', () => { isAborted = true; });

  try {
    let rawJsonText;
    let parsedData;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      if (isAborted) return;
      attempts++;

      try {
        rawJsonText = await callGroq(notes, attempts > 1, parsedData?.error || 'Validation failed');
        parsedData = JSON.parse(rawJsonText);
        const validated = StudyMaterialSchema.parse(parsedData);

        if (isAborted) return;
        return res.json(validated);
      } catch (err) {
        console.error(`Attempt ${attempts} failed:`, err.message);
        if (attempts >= maxAttempts) throw err;
        parsedData = { error: err.message };
      }
    }
  } catch (error) {
    console.error('Final Generation Error:', error);

    if (error.message === 'API_KEY_MISSING') {
      return res.status(500).json({
        error: 'Groq API key is missing. Add GROQ_API_KEY to server/.env'
      });
    }
    if (error.message === 'API_KEY_INVALID') {
      return res.status(401).json({
        error: 'The Groq API key is invalid. Get a valid key from console.groq.com.'
      });
    }
    if (error.message === 'RATE_LIMITED') {
      return res.status(429).json({
        error: 'Groq rate limit exceeded. Please try again in a minute.'
      });
    }
    if (error.message === 'TIMEOUT') {
      return res.status(504).json({
        error: 'Request timed out. Notes might be too long or service is slow.'
      });
    }
    if (error instanceof z.ZodError) {
      return res.status(422).json({
        error: 'AI output did not match expected structure. Try editing your notes.',
        details: error.errors
      });
    }
    if (error instanceof SyntaxError) {
      return res.status(422).json({
        error: 'AI returned malformed JSON. Please try again.'
      });
    }

    return res.status(500).json({
      error: `Failed to generate study materials: ${error.message}`
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    provider: 'groq',
    keyConfigured: !!apiKey && apiKey !== 'your_groq_api_key_here',
    envLoadedFrom: envPath,
    fallbackUsed
  });
});

// ──────────────────────────────────────────────
// SERVER STARTUP (auto-retry port)
// ──────────────────────────────────────────────
function startServer(port, maxRetries = 10) {
  const server = app.listen(port, () => {
    console.log(`\n🚀 Server running at http://localhost:${port}`);
    console.log(`   Health check:   http://localhost:${port}/health`);
    if (port !== Number(PORT)) {
      console.log(`   ⚠️  Port ${PORT} was busy — using ${port} instead.`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && maxRetries > 0) {
      console.log(`⚠️  Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1, maxRetries - 1);
    } else {
      console.error(`❌ Failed to start server:`, err.message);
      process.exit(1);
    }
  });
}

startServer(Number(PORT));
