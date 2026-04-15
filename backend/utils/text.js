export function tokenize(s) {
  if (!s || typeof s !== "string") return [];
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

export function uniqueTokens(tokens) {
  return [...new Set(tokens)];
}

/**
 * Proportion of query tokens found in corpus text (0–1).
 */
export function keywordMatchScore(queryTokens, text) {
  if (!queryTokens.length) return 0.5;
  const t = tokenize(text).join(" ");
  let hits = 0;
  for (const q of queryTokens) {
    if (t.includes(q)) hits += 1;
  }
  return hits / queryTokens.length;
}

/**
 * Disease relevance: tokens from disease string in title+abstract.
 */
export function diseaseRelevanceScore(diseaseTokens, title, abstract) {
  const blob = `${title || ""} ${abstract || ""}`.toLowerCase();
  if (!diseaseTokens.length) return 0.5;
  let hits = 0;
  for (const d of diseaseTokens) {
    if (blob.includes(d)) hits += 1;
  }
  return hits / diseaseTokens.length;
}

/**
 * Year in [minYear, maxYear] mapped to 0–1; recent = higher.
 */
export function recencyScore(year, minYear = 1990, maxYear = new Date().getFullYear() + 1) {
  if (year == null || Number.isNaN(Number(year))) return 0.35;
  const y = Number(year);
  if (y < minYear) return 0;
  if (y > maxYear) return 1;
  return (y - minYear) / (maxYear - minYear);
}
