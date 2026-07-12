export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API routes
    if (url.pathname === "/api/topics") {
      return handleTopics(request, env);
    }
    if (url.pathname === "/api/history") {
      return handleHistory(request, env);
    }

    // Fallback to static assets
    return env.ASSETS.fetch(request);
  }
};

async function handleTopics(request, env) {
  try {
    // Get categories
    const categoriesResult = await env.DB.prepare(
      "SELECT id, name, color FROM categories ORDER BY id"
    ).all();

    // Get topics
    const topicsResult = await env.DB.prepare(
      "SELECT id, text, category_id as category, tags FROM topics ORDER BY id"
    ).all();

    const data = {
      categories: categoriesResult.results,
      topics: topicsResult.results.map(t => ({
        ...t,
        tags: JSON.parse(t.tags)
      }))
    };

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
async function handleHistory(request, env) {
  if (request.method === "GET") {
    const deviceId = new URL(request.url).searchParams.get("device_id");
    if (!deviceId) {
      return new Response(JSON.stringify({ error: "device_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const history = await env.TALK_GACHA_KV.get(deviceId, "json");
      return new Response(JSON.stringify(history || []), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  if (request.method === "POST") {
    try {
      const { device_id, topic, timestamp } = await request.json();
      if (!device_id || !topic) {
        return new Response(JSON.stringify({ error: "device_id and topic required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const existing = await env.TALK_GACHA_KV.get(device_id, "json") || [];
      const entry = { topic, timestamp };
      const updated = [entry, ...existing].slice(0, 100);
      await env.TALK_GACHA_KV.put(device_id, JSON.stringify(updated));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
}