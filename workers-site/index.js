export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API routes
    if (url.pathname === "/api/topics") {
      return handleTopics(request, env);
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