import axios from "axios";
import { normalizeTrial } from "../utils/normalize.js";

const BASE = "https://clinicaltrials.gov/api/v2/studies";

/**
 * Fetch 20–50 clinical trials from ClinicalTrials.gov API v2.
 */
export async function fetchClinicalTrials(query, locationHint = "", pageSize = 40) {
  const size = Math.min(50, Math.max(20, pageSize));
  const q = [query, locationHint].filter(Boolean).join(" ");
  const { data } = await axios.get(BASE, {
    params: {
      "query.term": q,
      pageSize: size,
      format: "json",
    },
    timeout: 45000,
  });

  const studies = data?.studies || [];
  const out = [];

  for (const s of studies) {
    const p = s.protocolSection || {};
    const idModule = p.identificationModule || {};
    const statusModule = p.statusModule || {};
    const desc = p.descriptionModule || {};
    const cond = p.conditionsModule || {};
    const design = p.designModule || {};
    const contacts = p.contactsLocationsModule || {};
    const locs = contacts.locations || [];

    const title =
      idModule.briefTitle ||
      idModule.officialTitle ||
      "Clinical trial";

    const status =
      statusModule.overallStatus ||
      statusModule.lastKnownStatus ||
      "Unknown";

    const eligibility =
      desc.eligibilityCriteria ||
      (cond.conditions?.length ? `Conditions: ${cond.conditions.join(", ")}` : "") ||
      "";

    const locationStr = formatLocations(locs);
    const contact = formatContacts(contacts);

    const start = statusModule.startDateStruct?.date;
    let year = null;
    if (start && String(start).match(/^\d{4}/)) year = Number(String(start).slice(0, 4));

    const nctId = idModule.nctId || "";
    const url = nctId ? `https://clinicaltrials.gov/study/${nctId}` : "";

    out.push(
      normalizeTrial(
        {
          title,
          status,
          eligibility,
          location: locationStr,
          contact,
          url,
          year,
        },
        0
      )
    );
  }

  return out;
}

function formatLocations(locs) {
  if (!locs?.length) return "";
  return locs
    .slice(0, 5)
    .map((l) => {
      const facility = l.facility || "";
      const city = l.city || "";
      const country = l.country || "";
      return [facility, city, country].filter(Boolean).join(", ");
    })
    .filter(Boolean)
    .join(" | ");
}

function formatContacts(module) {
  const central = module.centralContacts?.[0];
  const overall = module.overallOfficials?.[0];
  const parts = [];
  if (central?.name) parts.push(`Central: ${central.name}${central.phone ? ` (${central.phone})` : ""}`);
  if (overall?.name) parts.push(`Official: ${overall.name}`);
  return parts.join("; ") || "";
}
