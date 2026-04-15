import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { normalizePublication } from "../utils/normalize.js";

const ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => ["PubmedArticle", "Author", "AbstractText"].includes(name),
});

/**
 * Step 1: esearch — Step 2: efetch (abstract XML) — returns 50–100 records.
 */
export async function fetchPubMedRecords(term, retmax = 80) {
  const count = Math.min(100, Math.max(50, retmax));

  const searchRes = await axios.get(ESEARCH, {
    params: {
      db: "pubmed",
      term,
      retmax: count,
      retmode: "json",
      sort: "relevance",
    },
    timeout: 45000,
  });

  const idList = searchRes.data?.esearchresult?.idlist || [];
  if (!idList.length) return [];

  const chunks = chunkArray(idList, 100);
  const articles = [];

  for (const chunk of chunks) {
    const fetchRes = await axios.get(EFETCH, {
      params: {
        db: "pubmed",
        id: chunk.join(","),
        retmode: "xml",
        rettype: "abstract",
      },
      timeout: 60000,
      responseType: "text",
    });

    let parsed;
    try {
      parsed = parser.parse(fetchRes.data);
    } catch (e) {
      console.warn("PubMed XML parse error:", e.message);
      continue;
    }
    const pubmedArticles =
      parsed?.PubmedArticleSet?.PubmedArticle ||
      parsed?.PubmedBookArticle ||
      [];
    const list = Array.isArray(pubmedArticles)
      ? pubmedArticles
      : [pubmedArticles].filter(Boolean);

    for (const article of list) {
      try {
      const medline = article.MedlineCitation || article;
      const articleData = medline.Article || {};
      const pmid =
        medline?.PMID?.["#text"] ?? medline?.PMID ?? extractPmidFromArticle(article);

      const title =
        articleData.ArticleTitle?.["#text"] ?? articleData.ArticleTitle ?? "";
      const abstract = extractAbstract(articleData.Abstract);
      const year = extractYear(articleData.Journal?.JournalIssue?.PubDate);
      const authors = extractAuthors(articleData.AuthorList?.Author);

      articles.push(
        normalizePublication(
          {
            title: String(title),
            abstract,
            authors,
            year,
            url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
            _rawSource: "pubmed",
          },
          "PubMed",
          0
        )
      );
      } catch (e) {
        console.warn("PubMed article skip:", e.message);
      }
    }
  }

  return articles;
}

function extractAbstract(abstractNode) {
  if (!abstractNode) return "";
  const texts = abstractNode.AbstractText;
  if (!texts) return "";
  if (Array.isArray(texts)) {
    return texts
      .map((t) => {
        if (typeof t === "string") return t;
        const label = t["@_Label"] ? `${t["@_Label"]}: ` : "";
        const body = t["#text"] ?? "";
        return `${label}${body}`;
      })
      .join("\n");
  }
  if (typeof texts === "string") return texts;
  return texts["#text"] ?? "";
}

function extractYear(pubDate) {
  if (!pubDate) return null;
  const y = pubDate.Year?.["#text"] ?? pubDate.Year ?? pubDate.MedlineDate;
  if (y && String(y).match(/^\d{4}/)) return Number(String(y).slice(0, 4));
  const md = pubDate.MedlineDate;
  if (typeof md === "string") {
    const m = md.match(/(\d{4})/);
    if (m) return Number(m[1]);
  }
  return null;
}

function extractAuthors(authorList) {
  if (!authorList) return [];
  const arr = Array.isArray(authorList) ? authorList : [authorList];
  return arr
    .map((a) => {
      const last = a.LastName?.["#text"] ?? a.LastName ?? "";
      const initials = a.ForeName?.["#text"] ?? a.Initials ?? "";
      const collective = a.CollectiveName?.["#text"] ?? a.CollectiveName;
      if (collective) return collective;
      return [last, initials].filter(Boolean).join(" ");
    })
    .filter(Boolean);
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function extractPmidFromArticle(article) {
  const list = article?.PubmedData?.ArticleIdList?.ArticleId;
  if (!list) return undefined;
  const arr = Array.isArray(list) ? list : [list];
  const pubmed = arr.find((x) => x?.["@_IdType"] === "pubmed");
  return pubmed?.["#text"] ?? pubmed;
}
