import { validateDeviceId, validateTopic } from './_validators.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id');

  if (request.method === 'GET') {
    if (!validateDeviceId(deviceId)) {
      return jsonResponse({ error: 'device_id required' }, 400);
    }
    try {
      const history = await env.TALK_GACHA_KV.get(deviceId, 'json');
      return jsonResponse(history || []);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  if (request.method === 'DELETE') {
    if (!validateDeviceId(deviceId)) {
      return jsonResponse({ error: 'device_id required' }, 400);
    }
    await env.TALK_GACHA_KV.delete(deviceId);
    return jsonResponse({ ok: true });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (_err) {
      return jsonResponse({ error: 'invalid JSON body' }, 400);
    }

    const { device_id, topic } = body || {};
    if (!validateDeviceId(device_id)) {
      return jsonResponse({ error: 'invalid device_id' }, 400);
    }

    const topicCheck = validateTopic(topic);
    if (!topicCheck.ok) {
      return jsonResponse({ error: topicCheck.reason || 'invalid topic' }, 400);
    }

    try {
      const existing = (await env.TALK_GACHA_KV.get(device_id, 'json')) || [];
      const entry = {
        text: topic.text,
        category: topic.category,
        color: topic.color,
        timestamp: topic.timestamp,
      };
      const updated = [entry, ...existing].slice(0, 100);
      await env.TALK_GACHA_KV.put(device_id, JSON.stringify(updated));
      return jsonResponse({ ok: true });
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
