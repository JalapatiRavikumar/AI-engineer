import axios from "axios";
import { normalizePublication } from "../utils/normalize.js";

const OPENALEX = "https://api.openalex.org/works";

/**
 * Fetch 50–100 OpenAlex works for expanded query.
 */
export async function fetchOpenAlexWorks(search, perPage = 80) {
  const count = Math.min(100, Math.max(50, perPage));
  const url = OPENALEX;
  let data;
  try {
    const res = await axios.get(url, {
      params: {
        search,
        per_page: count,
        filter: "has_abstract:true",
        sort: "cited_by_count:desc",
      },
      timeout: 45000,
      validateStatus: (s) => s < 500,
    });
    data = res.data;
    if (res.status >= 400 || !data?.results?.length) {
      const res2 = await axios.get(url, {
        params: { search, per_page: count, sort: "cited_by_count:desc" },
        timeout: 45000,
      });
      data = res2.data;
    }
  } catch (e) {
    console.warn("OpenAlex request failed:", e.message);
    return [];
  }

  if (!data?.results?.length) return [];

  return data.results.map((w) => {
    const year = w.publication_year ?? w.publication_date?.slice(0, 4) ?? null;
    const authors =
      w.authorships?.map((a) => a.author?.display_name).filter(Boolean) ?? [];
    const abstract =
      w.abstract_inverted_index != null
        ? reconstructInvertedAbstract(w.abstract_inverted_index)
        : "";
    const urlLink = w.doi
      ? `https://doi.org/${String(w.doi).replace(/^https?:\/\/doi\.org\//, "")}`
      : w.id || "";

    return normalizePublication(
      {
        title: w.title || "",
        abstract,
        authors,
        year: year ? Number(year) : null,
        url: urlLink,
        _rawSource: "openalex",
      },
      "OpenAlex",
      0
    );
  });
}

function reconstructInvertedAbstract(inv) {
  if (!inv || typeof inv !== "object") return "";
  const maxPos = Math.max(
    ...Object.values(inv).flatMap((positions) =>
      Array.isArray(positions) ? positions : [positions]
    ),
    -1
  );
  if (maxPos < 0) return "";
  const words = new Array(maxPos + 1);
  for (const [word, positions] of Object.entries(inv)) {
    const arr = Array.isArray(positions) ? positions : [positions];
    for (const p of arr) {
      if (typeof p === "number" && p >= 0 && p <= maxPos) words[p] = word;
    }
  }
  return words.filter(Boolean).join(" ");
}
