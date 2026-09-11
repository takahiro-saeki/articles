export async function readProbe(key, cache) {
  const response = await fetch(`${process.env.ARTICLE_ORIGIN}/${key}`, { cache });
  if (!response.ok) throw new Error(`Probe status ${response.status}`);
  return response.json();
}
