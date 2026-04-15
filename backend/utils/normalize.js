/**
 * Normalize heterogeneous API records into a common publication shape.
 */
export function normalizePublication(raw, source, relevanceScore = 0) {
  return {
    title: raw.title || "Untitled",
    abstract: raw.abstract || "",
    authors: Array.isArray(raw.authors) ? raw.authors : raw.authors ? [raw.authors] : [],
    year: raw.year ?? null,
    source,
    url: raw.url || "",
    relevanceScore: Number(relevanceScore) || 0,
    _rawSource: raw._rawSource,
  };
}

export function normalizeTrial(raw, relevanceScore = 0) {
  return {
    title: raw.title || "Untitled study",
    status: raw.status || "Unknown",
    eligibility: raw.eligibility || "",
    location: raw.location || "",
    contact: raw.contact || "",
    relevanceScore: Number(relevanceScore) || 0,
    url: raw.url || "",
    year: raw.year ?? null,
  };
}
