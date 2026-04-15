import { v4 as uuidv4 } from "uuid";
import UserSession from "../models/UserSession.js";
import { runResearchPipeline } from "../services/researchService.js";

export async function postResearch(req, res, next) {
  try {
    const { patientName, disease, query, location, sessionId } = req.body || {};

    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "query is required" });
    }

    let session = null;
    if (sessionId) {
      session = await UserSession.findOne({ sessionId });
    }

    const sid = session?.sessionId || uuidv4();
    const diseaseContext = {
      disease:
        (disease && String(disease).trim()) ||
        session?.diseaseContext?.disease ||
        "",
      patientName:
        (patientName && String(patientName).trim()) ||
        session?.diseaseContext?.patientName ||
        "",
      location:
        (location && String(location).trim()) ||
        session?.diseaseContext?.location ||
        "",
    };

    const result = await runResearchPipeline({
      patientName: diseaseContext.patientName,
      disease: diseaseContext.disease,
      query: query.trim(),
      location: diseaseContext.location,
      sessionDiseaseContext: session?.diseaseContext,
    });

    const userMessage = {
      role: "user",
      content: buildUserMessageContent({
        patientName: diseaseContext.patientName,
        disease: diseaseContext.disease,
        query: query.trim(),
        location: diseaseContext.location,
      }),
      meta: { patientName: diseaseContext.patientName, disease: diseaseContext.disease },
    };

    const assistantMessage = {
      role: "assistant",
      content: result.structuredAnswer,
      meta: {
        topPublications: result.topPublications,
        topTrials: result.topTrials,
        sources: result.sources,
      },
    };

    await UserSession.findOneAndUpdate(
      { sessionId: sid },
      {
        $set: {
          diseaseContext: {
            disease: result.disease || diseaseContext.disease,
            patientName: diseaseContext.patientName,
            location: diseaseContext.location,
          },
        },
        $push: { chatHistory: { $each: [userMessage, assistantMessage] } },
      },
      { upsert: true, new: true }
    );

    res.json({
      sessionId: sid,
      overview: extractSection(result.structuredAnswer, "1.", "2.") || result.structuredAnswer.slice(0, 500),
      structuredAnswer: result.structuredAnswer,
      sections: parseSections(result.structuredAnswer),
      researchPapers: result.topPublications,
      clinicalTrials: result.topTrials,
      sources: result.sources,
      expansion: result.expansion,
      stats: result.stats,
    });
  } catch (err) {
    next(err);
  }
}

function buildUserMessageContent({ patientName, disease, query, location }) {
  const parts = [];
  if (patientName) parts.push(`Name: ${patientName}`);
  if (disease) parts.push(`Disease/condition: ${disease}`);
  if (location) parts.push(`Location: ${location}`);
  parts.push(`Query: ${query}`);
  return parts.join("\n");
}

function extractSection(text, startMarker, endMarker) {
  const i = text.indexOf(startMarker);
  if (i === -1) return null;
  const j = text.indexOf(endMarker, i + 1);
  if (j === -1) return text.slice(i).trim();
  return text.slice(i, j).trim();
}

function parseSections(text) {
  return {
    raw: text,
    conditionOverview: extractNumbered(text, 1),
    researchInsights: extractNumbered(text, 2),
    clinicalTrialsSummary: extractNumbered(text, 3),
    keyTakeaways: extractNumbered(text, 4),
    sourcesSection: extractNumbered(text, 5),
  };
}

function extractNumbered(text, num) {
  const headers = [
    "Condition Overview",
    "Research Insights",
    "Clinical Trials Summary",
    "Key Takeaways",
    "Sources",
  ];
  const label = headers[num - 1];
  if (!label) return null;
  const idx = text.indexOf(label);
  if (idx === -1) return null;
  const rest = text.slice(idx);
  const nextHdr = new RegExp(
    `\\n\\s*\\d+\\.\\s*(?:${headers.filter((h) => h !== label).join("|")})`,
    "i"
  );
  const m = rest.slice(rest.indexOf("\n")).match(nextHdr);
  if (m && m.index != null) {
    return rest.slice(0, m.index + rest.indexOf("\n")).trim();
  }
  return rest.trim();
}

export async function getSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const session = await UserSession.findOne({ sessionId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (err) {
    next(err);
  }
}
