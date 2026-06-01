import { policyChunks } from "./policyDocs";

const getApiKey = () => {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  return key && key !== "sk-your-openai-api-key-here" ? key : null;
};

let cachedVectors = null;

async function getEmbedding(text) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.data[0].embedding;
}

function cosineSimilarity(a, b) {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-10);
}

export async function buildIndex() {
  const apiKey = getApiKey();
  if (!apiKey) {
    cachedVectors = policyChunks.map((chunk) => ({ ...chunk, embedding: null }));
    return cachedVectors;
  }

  const stored = sessionStorage.getItem("rag_vectors");
  if (stored) {
    cachedVectors = JSON.parse(stored);
    return cachedVectors;
  }

  const vectors = [];
  for (const chunk of policyChunks) {
    const embedding = await getEmbedding(chunk.title + ": " + chunk.content);
    vectors.push({ ...chunk, embedding });
  }

  sessionStorage.setItem("rag_vectors", JSON.stringify(vectors));
  cachedVectors = vectors;
  return vectors;
}

export async function retrieveRelevantDocs(query, topK = 3) {
  if (!cachedVectors) await buildIndex();

  if (!cachedVectors || cachedVectors.length === 0) return [];

  const hasEmbeddings = cachedVectors.some((v) => v.embedding);
  if (!hasEmbeddings) {
    const q = query.toLowerCase();
    const scored = cachedVectors.map((doc) => {
      const kwScore = doc.keywords.filter((kw) => q.includes(kw)).length;
      const titleScore = doc.title.toLowerCase().includes(q) ? 3 : 0;
      const contentScore = doc.content.toLowerCase().includes(q) ? 2 : 0;
      return { ...doc, score: kwScore + titleScore + contentScore };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, topK).filter((d) => d.score > 0);
  }

  const queryVec = await getEmbedding(query);
  if (!queryVec) return [];

  const scored = cachedVectors.map((doc) => ({
    ...doc,
    score: cosineSimilarity(queryVec, doc.embedding),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, topK).filter((d) => d.score > 0.3);
}

export function formatPolicyContext(docs) {
  if (!docs || docs.length === 0) return "";
  return docs
    .map((d) => `[${d.title}]: ${d.content}`)
    .join("\n\n");
}
