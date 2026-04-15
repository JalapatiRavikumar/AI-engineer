import {
  diseaseRelevanceScore,
  keywordMatchScore,
  recencyScore,
} from "./text.js";

/** PubMed / peer-reviewed index credibility */
export const SOURCE_CREDIBILITY = {
  pubmed: 1,
  openalex: 0.95,
  crossref: 0.9,
  other: 0.85,
};

/**
 * Weighted score per spec:
 * 0.4 relevance + 0.3 recency + 0.3 keyword match,
 * then multiply by source credibility (blended into final ranking).
 */
export function scorePublication(pub, diseaseTokens, queryTokens) {
  const title = pub.title || "";
  const abstract = pub.abstract || "";
  const rel = diseaseRelevanceScore(diseaseTokens, title, abstract);
  const rec = recencyScore(pub.year);
  const kw = keywordMatchScore(queryTokens, `${title} ${abstract}`);
  const base = 0.4 * rel + 0.3 * rec + 0.3 * kw;
  const cred =
    SOURCE_CREDIBILITY[pub._rawSource] ?? SOURCE_CREDIBILITY.other;
  const finalScore = base * (0.85 + 0.15 * cred);
  return { ...pub, relevanceScore: finalScore, _components: { rel, rec, kw, cred } };
}

export function scoreTrial(trial, diseaseTokens, queryTokens) {
  const blob = `${trial.title || ""} ${trial.eligibility || ""}`.toLowerCase();
  const rel = diseaseRelevanceScore(diseaseTokens, trial.title, trial.eligibility);
  const rec = recencyScore(trial.year);
  const kw = keywordMatchScore(queryTokens, blob);
  const base = 0.4 * rel + 0.3 * rec + 0.3 * kw;
  const finalScore = base * 0.98;
  return { ...trial, relevanceScore: finalScore };
}

export function sortByScore(items) {
  return [...items].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}
