import { expandMedicalQuery } from "./queryExpansionService.js";
import { fetchOpenAlexWorks } from "./openAlexService.js";
import { fetchPubMedRecords } from "./pubmedService.js";
import { fetchClinicalTrials } from "./clinicalTrialsService.js";
import { scorePublication, scoreTrial, sortByScore } from "../utils/ranking.js";
import { generateResearchAnswer } from "./ollamaService.js";

function dedupePublications(items) {
  const seen = new Map();
  for (const p of items) {
    const key = (p.title || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .slice(0, 120);
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()];
}

function stripInternal(pub) {
  const { _rawSource, _components, ...rest } = pub;
  return rest;
}

function stripTrial(t) {
  return { ...t };
}

/**
 * Orchestrates retrieval (50–300+ raw), ranking, top-K selection, LLM synthesis.
 */
export async function runResearchPipeline({
  patientName,
  disease,
  query,
  location,
  sessionDiseaseContext,
}) {
  const diseaseResolved =
    (disease && String(disease).trim()) ||
    sessionDiseaseContext?.disease ||
    "";
  const locationResolved =
    (location && String(location).trim()) ||
    sessionDiseaseContext?.location ||
    "";

  const expansion = expandMedicalQuery({
    disease: diseaseResolved,
    query: query || "",
  });

  const retrievalQuery = expansion.expandedBoolean || expansion.combinedQuery;

  const [openAlex, pubmed, trialsRaw] = await Promise.all([
    fetchOpenAlexWorks(expansion.openAlexSearch || retrievalQuery, 80).catch((e) => {
      console.warn("OpenAlex:", e.message);
      return [];
    }),
    fetchPubMedRecords(expansion.pubmedTerm || retrievalQuery, 80).catch((e) => {
      console.warn("PubMed:", e.message);
      return [];
    }),
    fetchClinicalTrials(retrievalQuery, locationResolved, 40).catch((e) => {
      console.warn("ClinicalTrials:", e.message);
      return [];
    }),
  ]);

  const mergedPubs = dedupePublications([...pubmed, ...openAlex]);

  const rankedPubs = sortByScore(
    mergedPubs.map((p) =>
      scorePublication(p, expansion.diseaseTokens, expansion.queryTokens)
    )
  );

  const rankedTrials = sortByScore(
    trialsRaw.map((t) =>
      scoreTrial(t, expansion.diseaseTokens, expansion.queryTokens)
    )
  );

  const topPublications = rankedPubs.slice(0, 8).map(stripInternal);
  const topTrials = rankedTrials.slice(0, 5).map(stripTrial);

  let llmText;
  try {
    llmText = await generateResearchAnswer({
      disease: diseaseResolved,
      query: query || "",
      location: locationResolved,
      topPublications,
      topTrials,
    });
  } catch (e) {
    console.error("Ollama error:", e.message);
    llmText = `Structured summary could not be generated (${e.message}). Below are ranked publications and trials from live sources only.`;
  }

  return {
    patientName: patientName || sessionDiseaseContext?.patientName || "",
    disease: diseaseResolved,
    query: query || "",
    location: locationResolved,
    expansion: {
      combinedQuery: expansion.combinedQuery,
      expandedBoolean: expansion.expandedBoolean,
      synonyms: expansion.synonyms,
    },
    stats: {
      rawCounts: {
        openAlex: openAlex.length,
        pubMed: pubmed.length,
        clinicalTrials: trialsRaw.length,
        mergedPublications: mergedPubs.length,
      },
    },
    topPublications,
    topTrials,
    structuredAnswer: llmText,
    sources: buildSourcesList(topPublications, topTrials),
  };
}

function buildSourcesList(pubs, trials) {
  const papers = pubs.map((p) => ({
    type: "publication",
    title: p.title,
    authors: p.authors,
    year: p.year,
    url: p.url,
    source: p.source,
  }));
  const tr = trials.map((t) => ({
    type: "trial",
    title: t.title,
    status: t.status,
    url: t.url,
  }));
  return [...papers, ...tr];
}
