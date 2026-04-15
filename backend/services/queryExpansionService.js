import { tokenize, uniqueTokens } from "../utils/text.js";

const SYNONYM_HINTS = {
  cancer: ["neoplasm", "malignancy", "oncology", "tumor", "tumour"],
  diabetes: ["diabetes mellitus", "DM", "glycemic", "hyperglycemia"],
  parkinson: ["Parkinson disease", "PD", "parkinsonism"],
  lung: ["pulmonary", "respiratory"],
  treatment: ["therapy", "intervention", "management"],
  trial: ["clinical trial", "RCT", "randomized"],
  vitamin: ["vitamin D", "cholecalciferol", "25-hydroxyvitamin D"],
};

/**
 * Builds expanded search strings and token lists for retrieval + ranking.
 */
export function expandMedicalQuery({ disease = "", query = "" }) {
  const d = disease.trim();
  const q = query.trim();
  const combined = [q, d].filter(Boolean).join(" ");
  const andForm =
    q && d
      ? `${q} AND ${d}`
      : combined;

  const extraSynonyms = [];
  const lower = `${d} ${q}`.toLowerCase();
  for (const [key, syns] of Object.entries(SYNONYM_HINTS)) {
    if (lower.includes(key)) extraSynonyms.push(...syns);
  }

  const treatmentKeywords = [
    "treatment",
    "therapy",
    "pharmacotherapy",
    "surgery",
    "immunotherapy",
    "radiotherapy",
  ];
  const trialKeywords = [
    "clinical trial",
    "phase 2",
    "phase 3",
    "randomized",
    "NCT",
    "recruiting",
  ];

  const openAlexFilter = buildOpenAlexQuery(andForm, d, q, extraSynonyms);
  const pubmedTerm = buildPubMedTerm(andForm, d, q, extraSynonyms.slice(0, 5));

  const allText = [d, q, andForm, ...extraSynonyms, ...treatmentKeywords.slice(0, 3), ...trialKeywords.slice(0, 2)].join(" ");
  const expansionTokens = uniqueTokens(tokenize(allText));

  return {
    combinedQuery: combined,
    expandedBoolean: andForm,
    openAlexSearch: openAlexFilter,
    pubmedTerm,
    synonyms: uniqueTokens(extraSynonyms.map((s) => s.toLowerCase())),
    treatmentKeywords,
    trialKeywords,
    expansionTokens,
    diseaseTokens: uniqueTokens(tokenize(d)),
    queryTokens: uniqueTokens(tokenize(`${q} ${d}`)),
  };
}

function buildOpenAlexQuery(andForm, disease, query, synonyms) {
  const parts = [andForm];
  if (disease && query && !andForm.includes("AND")) {
    parts.push(`${query} ${disease}`);
  }
  if (synonyms.length) {
    parts.push(synonyms.slice(0, 4).join(" "));
  }
  return parts.filter(Boolean).join(" ");
}

function buildPubMedTerm(andForm, disease, query, synonymSlice) {
  const syn = synonymSlice.length ? ` OR (${synonymSlice.join(" OR ")})` : "";
  return `(${andForm})${syn}`;
}
