import axios from "axios";

const DEFAULT_BASE = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "mistral";

/**
 * Grounded generation: model must only use provided publications and trials.
 */
export async function generateResearchAnswer({
  disease,
  query,
  location,
  topPublications,
  topTrials,
}) {
  const pubBlock = formatPublications(topPublications);
  const trialBlock = formatTrials(topTrials);

  const prompt = `You are a medical research assistant.
Use ONLY the provided data below. Do not invent studies, trials, authors, or outcomes not explicitly supported by the data.
If the data is insufficient to answer precisely, say so clearly.

Context:
Disease: ${disease || "Not specified"}
User Query: ${query}
Location (for trials context): ${location || "Not specified"}

Publications:
${pubBlock}

Clinical Trials:
${trialBlock}

Generate response in structured format with these exact section headings:

1. Condition Overview
2. Research Insights
3. Clinical Trials Summary
4. Key Takeaways
5. Sources (with title, authors, year, link)

Be concise and factual. Cite only from the lists above.`;

  const base = DEFAULT_BASE.replace(/\/$/, "");
  const url = `${base}/api/generate`;

  const { data } = await axios.post(
    url,
    {
      model: DEFAULT_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 2048,
      },
    },
    { timeout: 120000 }
  );

  const text = data?.response?.trim() || data?.message?.content || "";
  if (!text) {
    throw new Error("Ollama returned an empty response. Is Ollama running with model " + DEFAULT_MODEL + "?");
  }
  return text;
}

function formatPublications(list) {
  if (!list?.length) return "(none)";
  return list
    .map((p, i) => {
      const authors = Array.isArray(p.authors) ? p.authors.slice(0, 5).join(", ") : p.authors;
      return `[${i + 1}] ${p.title} | ${authors || "Unknown authors"} | ${p.year || "?"} | ${p.url || ""}\nAbstract excerpt: ${truncate(p.abstract, 400)}`;
    })
    .join("\n\n");
}

function formatTrials(list) {
  if (!list?.length) return "(none)";
  return list
    .map((t, i) => {
      return `[${i + 1}] ${t.title} | Status: ${t.status} | Location: ${t.location || "N/A"}\nEligibility excerpt: ${truncate(t.eligibility, 300)}\nContact: ${t.contact || "N/A"} | ${t.url || ""}`;
    })
    .join("\n\n");
}

function truncate(s, n) {
  if (!s) return "";
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
