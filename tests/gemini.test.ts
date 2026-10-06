import { describe, expect, it } from 'vitest';
import { defaultPlan } from '../src/data/plan';
import {
  buildGenerateContentBody,
  buildInteractionsBody,
  buildUserPrompt,
  errorFromBody,
  extractText,
  friendlyError,
  GeminiError,
  parseAnalysis,
} from '../src/lib/gemini';

const { meals } = defaultPlan;

const reply = JSON.stringify({
  matched_meal_id: 'gujarati-thali',
  items: [
    { name: 'Rotli with ghee', portion: '3 rotli (~120 g)', calories: 390, protein: 10, carbs: 60, fat: 11 },
    { name: 'Toor dal', portion: '1 bowl (~250 g)', calories: 230, protein: 12.5, carbs: 32, fat: 5 },
  ],
  confidence: 'medium',
  notes: 'Ghee amount is a guess.',
});

describe('Gemini photo analysis', () => {
  it('gives Gemini the meal library and any note', () => {
    const prompt = buildUserPrompt(meals, ' extra ghee on the rotli ');
    expect(prompt).toContain('Extra details from me: extra ghee on the rotli');
    expect(prompt).toContain('id "gujarati-thali": Gujarati thali');
    expect(prompt).toContain('850 cal, 29 g protein');
    expect(buildUserPrompt(meals, '')).not.toContain('Extra details');
  });

  it('builds both request shapes with the image and JSON schema', () => {
    const a = buildInteractionsBody('gemini-3.8-flash', 'AAAA', 'image/jpeg', 'p');
    expect(a.input[1]).toEqual({ type: 'image', data: 'AAAA', mime_type: 'image/jpeg' });
    expect(a.response_format.mime_type).toBe('application/json');
    const b = buildGenerateContentBody('AAAA', 'image/jpeg', 'p');
    expect(b.contents[0].parts[1]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } });
    expect(b.generationConfig.responseMimeType).toBe('application/json');
  });

  it('reads text from the Interactions API response', () => {
    const json = { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: reply }] }] };
    expect(extractText(json)).toBe(reply);
  });

  it('reads text from the generateContent response, skipping thoughts', () => {
    const json = { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: reply }] } }] };
    expect(extractText(json)).toBe(reply);
    expect(extractText({})).toBe('');
  });

  it('parses and checks the analysis', () => {
    const a = parseAnalysis(reply, meals);
    expect(a.matchedMealId).toBe('gujarati-thali');
    expect(a.items).toHaveLength(2);
    expect(a.items[1]).toEqual({ name: 'Toor dal', portion: '1 bowl (~250 g)', calories: 230, protein: 12.5, carbs: 32, fat: 5 });
    expect(a.confidence).toBe('medium');
  });

  it('copes with code fences, unknown meal ids and silly numbers', () => {
    const messy = '```json\n' + JSON.stringify({
      matched_meal_id: 'not-a-real-meal',
      items: [{ name: '', portion: 'lots', calories: -50, protein: '12', carbs: 99999, fat: null }],
      confidence: 'very sure',
      notes: 5,
    }) + '\n```';
    const a = parseAnalysis(messy, meals);
    expect(a.matchedMealId).toBeNull();
    expect(a.items[0]).toEqual({ name: 'Food', portion: 'lots', calories: 0, protein: 12, carbs: 500, fat: 0 });
    expect(a.confidence).toBe('low');
    expect(a.notes).toBe('');
  });

  it('rejects replies that are not JSON', () => {
    expect(() => parseAnalysis('Sorry, I cannot help', meals)).toThrow();
  });

  it('reads Google error bodies, including the list-wrapped form', () => {
    const invalidKey = [{ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }];
    expect(errorFromBody(400, invalidKey).kind).toBe('bad-key');
    expect(errorFromBody(429, { error: { message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }).kind).toBe('rate-limit');
    const other = errorFromBody(500, null);
    expect(other.kind).toBe('error');
    expect(other.message).toBe('HTTP 500');
  });

  it('turns errors into friendly messages', () => {
    expect(friendlyError(new GeminiError('rate-limit', 'x'))).toMatch(/free limit/);
    expect(friendlyError(new GeminiError('bad-key', 'x'))).toMatch(/API key/);
    expect(friendlyError(new Error('boom'))).toMatch(/boom/);
  });
});
