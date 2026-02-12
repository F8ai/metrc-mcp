/**
 * Vercel Edge: Chat endpoint using OpenRouter (GPT-OSS-120B) with METRC MCP tools.
 * POST body: { message: string } or { messages: Array<{role, content}> }
 * Uses OPENROUTER_API_KEY, OPENROUTER_MODEL (default: openai/gpt-4o), METRC_* for tools.
 */

export const config = { runtime: 'edge' };

import { getOpenAITools, executeTool } from '../lib/metrc-edge.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o';
const MAX_TOOL_ROUNDS = 8;

function getApiKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is required');
  return key;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { message, messages: existingMessages } = body;
  let messages = Array.isArray(existingMessages) ? [...existingMessages] : [];
  if (typeof message === 'string' && message.trim()) {
    messages.push({ role: 'user', content: message.trim() });
  }
  if (messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Provide "message" or "messages" in the request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const systemPrompt = `You are a helpful assistant with access to METRC (cannabis tracking) tools for the Colorado sandbox. When the user asks about facilities, packages, harvests, plants, items, locations, or other METRC data, use the provided tools. Call tools with the correct arguments (e.g. license_number from metrc_get_facilities when needed). Summarize results clearly.`;

  const tools = getOpenAITools();
  const apiKey = getApiKey();
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
      return new Response(
        JSON.stringify({ error: 'OpenRouter request failed', status: res.status, detail: text }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) {
      return new Response(
        JSON.stringify({ error: 'No choices in OpenRouter response', raw: data }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    lastResponse = choice;
    const delta = choice.message || choice.delta || {};
    const toolCalls = delta.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      const content = delta.content ?? choice.text ?? '';
      return new Response(
        JSON.stringify({
          message: typeof content === 'string' ? content : (content[0]?.text ?? ''),
          role: 'assistant',
          finish_reason: choice.finish_reason,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
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
  return new Response(
    JSON.stringify({
      message: typeof content === 'string' ? content : (content[0]?.text ?? ''),
      role: 'assistant',
      finish_reason: 'max_tool_rounds',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
