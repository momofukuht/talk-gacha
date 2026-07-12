export async function onRequest({ env }) {
  try {
    const categoriesResult = await env.DB.prepare(
      "SELECT id, name, color FROM categories ORDER BY id"
    ).all();

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