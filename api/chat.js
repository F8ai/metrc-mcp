/**
 * Vercel Edge: Chat endpoint using OpenRouter with METRC MCP tools.
 * POST body: { message: string, messages?: [], license_number?: string }
 * OpenRouter key: from OPENROUTER_KEY_URL (Railway edge, rotated) or fallback OPENROUTER_API_KEY.
 * METRC_* for tools.
 */

export const config = { runtime: 'edge' };

import { getOpenAITools, executeTool } from '../lib/metrc-edge.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o';
const MAX_TOOL_ROUNDS = 8;

const DEFAULT_ORIGIN = 'https://f8ai.github.io';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGIN)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function getCorsHeaders(req) {
  const origin = req?.headers?.get?.('origin') || '';
  const matched = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': matched,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function getApiKey() {
  const keyUrl = process.env.OPENROUTER_KEY_URL;
  if (keyUrl) {
    const res = await fetch(keyUrl);
    if (!res.ok) throw new Error(`OpenRouter key URL failed: ${res.status}`);
    const body = await res.text();
    try {
      const j = JSON.parse(body);
      return j.key ?? j.OPENROUTER_API_KEY ?? j.api_key ?? body;
    } catch {
      return body.trim();
    }
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY or OPENROUTER_KEY_URL is required');
  return key;
}

// Store req in module scope for jsonResponse calls that don't pass it
let _currentReq = null;

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(_currentReq), ...headers },
  });
}

export default async function handler(req) {
  _currentReq = req;
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { message, messages: existingMessages, license_number: defaultLicense } = body;
  let messages = Array.isArray(existingMessages) ? [...existingMessages] : [];
  if (typeof message === 'string' && message.trim()) {
    messages.push({ role: 'user', content: message.trim() });
  }
  if (messages.length === 0) {
    return jsonResponse({ error: 'Provide "message" or "messages" in the request body' }, 400);
  }

  let systemPrompt = `You are a helpful assistant with access to METRC (cannabis tracking) tools for the Colorado sandbox. When the user asks about facilities, packages, harvests, plants, items, locations, or other METRC data, use the provided tools. Call tools with the correct arguments (e.g. license_number from metrc_get_facilities when needed). Summarize results clearly.`;
  if (defaultLicense && String(defaultLicense).trim()) {
    systemPrompt += ` The user has selected facility license_number: ${String(defaultLicense).trim()}. Use this license_number for all METRC tool calls unless the user explicitly asks about a different facility.`;
  }

  const tools = getOpenAITools();
  const apiKey = await getApiKey();
  const model = body.model || DEFAULT_MODEL;

  const requestMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  let round = 0;
  let lastResponse;

  while (round <= MAX_TOOL_ROUNDS) {
    const payload = {
      model,
      messages: requestMessages,
      ...(round === 0 ? { tools, tool_choice: 'auto' } : {}),
    };

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': req.headers.get('origin') || req.url || '',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return jsonResponse({ error: 'OpenRouter request failed', status: res.status, detail: text }, 502);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) {
      return jsonResponse({ error: 'No choices in OpenRouter response', raw: data }, 502);
    }

    lastResponse = choice;
    const delta = choice.message || choice.delta || {};
    const toolCalls = delta.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      const content = delta.content ?? choice.text ?? '';
      return jsonResponse({
        message: typeof content === 'string' ? content : (content[0]?.text ?? ''),
        role: 'assistant',
        finish_reason: choice.finish_reason,
      });
    }

    requestMessages.push({
      role: 'assistant',
      content: delta.content ?? null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.function?.name, arguments: tc.function?.arguments ?? '{}' },
      })),
    });

    for (const tc of toolCalls) {
      const name = tc.function?.name;
      let args = {};
      try {
        if (tc.function?.arguments) args = JSON.parse(tc.function.arguments);
      } catch (_) {}
      let text;
      try {
        text = await executeTool(name, args);
      } catch (err) {
        text = `Error: ${err.message}`;
      }
      requestMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: text,
      });
    }

    round++;
  }

  const content = lastResponse?.message?.content ?? lastResponse?.text ?? 'Tool loop limit reached.';
  return jsonResponse({
    message: typeof content === 'string' ? content : (content[0]?.text ?? ''),
    role: 'assistant',
    finish_reason: 'max_tool_rounds',
  });
}
