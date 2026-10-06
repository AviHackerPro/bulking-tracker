// AI photo analysis of meals using Google's Gemini API.
//
// The photo goes straight from the phone to Google with your own API key
// (stored only on the phone). Gemini returns a structured list of foods
// with estimated portions and macros, which you review before anything
// is logged. Results are estimates: hidden oil, ghee and portion size
// are hard to judge from a photo.

import type { Macros, Meal } from './types';

export const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', hint: 'Most accurate' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', hint: 'Faster, more free uses per day' },
] as const;
export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id;

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface AnalysedItem extends Macros {
  name: string;
  /** Human description of the portion, e.g. "2 rotli (~80 g)". */
  portion: string;
}

export interface PhotoAnalysis {
  /** Id of a meal from your library that the photo clearly shows, or null. */
  matchedMealId: string | null;
  items: AnalysedItem[];
  confidence: 'low' | 'medium' | 'high';
  notes: string;
}

// ----- Request ------------------------------------------------------------

/** JSON Schema the reply must follow. */
export const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    matched_meal_id: { type: 'string', description: 'Exact id from the meal list if the photo clearly shows that meal, otherwise an empty string.' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          portion: { type: 'string', description: 'Estimated amount, with grams, e.g. "2 rotli (~80 g)".' },
          calories: { type: 'number' },
          protein: { type: 'number', description: 'grams' },
          carbs: { type: 'number', description: 'grams' },
          fat: { type: 'number', description: 'grams' },
        },
        required: ['name', 'portion', 'calories', 'protein', 'carbs', 'fat'],
      },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    notes: { type: 'string', description: 'One or two short sentences, e.g. what was hard to judge.' },
  },
  required: ['matched_meal_id', 'items', 'confidence', 'notes'],
} as const;

export const SYSTEM_INSTRUCTION = [
  'You estimate the nutrition of a meal from a photo for a teenager tracking a healthy weight-gain diet.',
  'The person is lacto-vegetarian (dairy yes; no meat, fish or eggs) and lives in Australia. Many meals are Gujarati/Indian home cooking',
  '(rotli, dal, shaak, rice, kadhi, thepla, etc.), but they eat all kinds of food.',
  'List each distinct food you can see as a separate item with an estimated portion (include grams) and its calories, protein, carbs and fat for that portion.',
  'Allow for typical cooking oil or ghee in home-cooked dishes. Be realistic rather than optimistic, and never invent foods you cannot see.',
  'If the photo clearly shows one of the listed meals from their own library, put its id in matched_meal_id; otherwise leave it empty.',
  'If the image is not food, return no items and say so in notes.',
].join(' ');

export function buildUserPrompt(meals: Meal[], note: string): string {
  const library = meals
    .map((m) => `- id "${m.id}": ${m.name} (${m.ingredients}) = ${m.calories} cal, ${m.protein} g protein, ${m.carbs} g carbs, ${m.fat} g fat`)
    .join('\n');
  return [
    'Estimate the nutrition of the food in this photo.',
    note.trim() ? `Extra details from me: ${note.trim()}` : '',
    'My usual meals, for reference:',
    library,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Body for the Interactions API (POST /v1beta/interactions). */
export function buildInteractionsBody(model: string, imageBase64: string, mimeType: string, prompt: string) {
  return {
    model,
    system_instruction: SYSTEM_INSTRUCTION,
    input: [
      { type: 'text', text: prompt },
      { type: 'image', data: imageBase64, mime_type: mimeType },
    ],
    response_format: { type: 'text', mime_type: 'application/json', schema: ANALYSIS_SCHEMA },
    generation_config: { thinking_level: 'low' },
  };
}

/** Body for the classic generateContent API (used if Interactions isn't available). */
export function buildGenerateContentBody(imageBase64: string, mimeType: string, prompt: string) {
  return {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: ANALYSIS_SCHEMA },
  };
}

// ----- Response -----------------------------------------------------------

/** Pull the generated text out of either API's response. */
export function extractText(json: unknown): string {
  if (typeof json !== 'object' || json === null) return '';
  const j = json as Record<string, unknown>;
  const texts: string[] = [];
  const collect = (content: unknown) => {
    if (!Array.isArray(content)) return;
    for (const c of content) if (c && typeof c === 'object' && typeof (c as { text?: unknown }).text === 'string') texts.push((c as { text: string }).text);
  };
  // Interactions API: steps[].content[] (model_output steps), or outputs[]
  if (Array.isArray(j.steps)) {
    for (const s of j.steps as { type?: string; content?: unknown }[]) if (!s.type || s.type === 'model_output') collect(s.content);
  }
  if (texts.length === 0 && Array.isArray(j.outputs)) collect(j.outputs);
  // generateContent: candidates[0].content.parts[]
  if (texts.length === 0 && Array.isArray(j.candidates)) {
    const parts = (j.candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;
    collect(Array.isArray(parts) ? parts.filter((p) => !(p as { thought?: boolean }).thought) : parts);
  }
  return texts.join('').trim();
}

const clamp = (v: unknown, max: number): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Parse and sanity-check the model's JSON. Throws if it isn't usable. */
export function parseAnalysis(text: string, meals: Meal[]): PhotoAnalysis {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const raw = JSON.parse(cleaned) as Record<string, unknown>;
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map((i) => ({
      name: String(i.name ?? '').trim() || 'Food',
      portion: String(i.portion ?? '').trim(),
      calories: Math.round(clamp(i.calories, 3000)),
      protein: round1(clamp(i.protein, 300)),
      carbs: round1(clamp(i.carbs, 500)),
      fat: round1(clamp(i.fat, 300)),
    }))
    .slice(0, 12);
  const id = typeof raw.matched_meal_id === 'string' ? raw.matched_meal_id.trim() : '';
  const confidence = raw.confidence === 'high' || raw.confidence === 'medium' ? raw.confidence : 'low';
  return {
    matchedMealId: id && meals.some((m) => m.id === id) ? id : null,
    items,
    confidence,
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : '',
  };
}

// ----- Calling the API ----------------------------------------------------

export type GeminiErrorKind = 'no-key' | 'bad-key' | 'rate-limit' | 'blocked' | 'offline' | 'bad-reply' | 'error';

export class GeminiError extends Error {
  constructor(public kind: GeminiErrorKind, message: string) {
    super(message);
  }
}

export function friendlyError(e: unknown): string {
  const kind = e instanceof GeminiError ? e.kind : 'error';
  switch (kind) {
    case 'no-key': return 'Add your Gemini API key in Settings first.';
    case 'bad-key': return 'Gemini didn’t accept your API key. Check it in Settings.';
    case 'rate-limit': return 'You’ve hit Gemini’s free limit for now. Try again in a minute, or later today.';
    case 'blocked': return 'Gemini couldn’t analyse this photo. Try another one.';
    case 'offline': return 'You’re offline. Photo analysis needs the internet.';
    case 'bad-reply': return 'Gemini’s answer didn’t make sense. Please try again.';
    default: return `Something went wrong${e instanceof Error && e.message ? `: ${e.message}` : ''}. Please try again.`;
  }
}

async function post(url: string, apiKey: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new GeminiError(navigator.onLine === false ? 'offline' : 'error', 'Network error');
  }
}

/** Turn an error response (Google sometimes wraps it in a list) into a GeminiError. */
export function errorFromBody(status: number, body: unknown): GeminiError {
  const first = Array.isArray(body) ? body[0] : body;
  const err = (first as { error?: { message?: string; status?: string; details?: { reason?: string }[] } } | undefined)?.error;
  const message = err?.message ?? `HTTP ${status}`;
  const reasons = (err?.details ?? []).map((d) => d?.reason ?? '');
  if (status === 429 || err?.status === 'RESOURCE_EXHAUSTED') return new GeminiError('rate-limit', message);
  if (status === 401 || status === 403 || reasons.includes('API_KEY_INVALID') || /api key/i.test(message)) {
    return new GeminiError('bad-key', message);
  }
  return new GeminiError('error', message);
}

async function errorFrom(res: Response): Promise<GeminiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  return errorFromBody(res.status, body);
}

/** Send one request; tries the Interactions API, then falls back to generateContent. */
async function generate(
  apiKey: string,
  model: string,
  interactionsBody: unknown,
  generateBody: unknown,
  signal?: AbortSignal,
): Promise<string> {
  if (!apiKey.trim()) throw new GeminiError('no-key', 'No API key');
  const classic = () => post(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, apiKey, generateBody, signal);

  // Try the newer Interactions API first.
  const res = await post(`${API_BASE}/interactions`, apiKey, interactionsBody, signal);
  if (res.ok) {
    const text = extractText(await res.json());
    if (text) return text;
  } else {
    const err = await errorFrom(res);
    // Key and quota problems won't be fixed by the other endpoint.
    if (err.kind === 'bad-key' || err.kind === 'rate-limit') throw err;
  }

  // Fall back to the classic generateContent endpoint.
  const res2 = await classic();
  if (!res2.ok) throw await errorFrom(res2);
  const text = extractText(await res2.json());
  if (!text) throw new GeminiError('blocked', 'Empty reply');
  return text;
}

export async function analyseMealPhoto(opts: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  note: string;
  meals: Meal[];
  signal?: AbortSignal;
}): Promise<PhotoAnalysis> {
  const prompt = buildUserPrompt(opts.meals, opts.note);
  const text = await generate(
    opts.apiKey,
    opts.model,
    buildInteractionsBody(opts.model, opts.imageBase64, opts.mimeType, prompt),
    buildGenerateContentBody(opts.imageBase64, opts.mimeType, prompt),
    opts.signal,
  );
  try {
    return parseAnalysis(text, opts.meals);
  } catch {
    throw new GeminiError('bad-reply', 'Could not read the reply');
  }
}

/** Quick check that a key works (a tiny text-only request). */
export async function testGeminiKey(apiKey: string, model: string): Promise<void> {
  const prompt = 'Reply with the single word OK.';
  await generate(
    apiKey,
    model,
    { model, input: prompt, generation_config: { thinking_level: 'low', max_output_tokens: 20 } },
    { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 20 } },
  );
}
