import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { shoppingThumbnail } from "./report.mjs";

const countries = new Map([
  ["United States", "US"], ["Canada", "CA"], ["United Kingdom", "GB"], ["Australia", "AU"],
  ["Germany", "DE"], ["France", "FR"], ["India", "IN"], ["Japan", "JP"],
]);
const exchangeAngles = new Map([
  ["secret santa", "Secret Santa gifts clever hobby kits"],
  ["white elephant", "White Elephant gifts small tabletop games"],
]);

export function searchCountry(region) {
  return countries.get(region.trim());
}

export async function readSerpApiKey() {
  const envKey = process.env.SERPAPI_API_KEY?.trim();
  if (envKey) return envKey;
  const path = process.env.SERPAPI_API_KEY_FILE?.trim() || join(homedir(), ".config", "serpapi.txt");
  try {
    return (await readFile(path, "utf8")).trim() || null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error("Could not read the SerpApi key file.");
  }
}

async function searchShopping(query, brief, country, apiKey, signal) {
  const url = new URL("https://serpapi.com/search");
  url.search = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    gl: country === "GB" ? "uk" : country.toLowerCase(),
    hl: "en",
    location: brief.region.trim(),
    api_key: apiKey,
  });
  if (brief.budget !== null) url.searchParams.set("max_price", brief.budget);

  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
  });
  if (!response.ok) throw new Error("Google Shopping request failed.");
  const data = await response.json();
  if (data.error || (data.shopping_results !== undefined && !Array.isArray(data.shopping_results))) {
    throw new Error("Google Shopping returned no usable response.");
  }
  return data.shopping_results ?? [];
}

export async function discoverShopping(brief, apiKey, signal) {
  const country = searchCountry(brief.region);
  if (!country) return { candidates: [], note: "SerpApi Google Shopping is unavailable for this region." };

  const interests = brief.interests.trim();
  const recipient = brief.recipient.trim();
  const occasion = brief.occasion.trim();
  const giftSearch = [occasion, "gifts", interests || (recipient && `for ${recipient}`)].filter(Boolean).join(" ");
  const exchangeAngle = exchangeAngles.get(occasion.toLowerCase().replace(/[-\s]+/g, " "));
  const results = await Promise.allSettled(
    [exchangeAngle || interests || `practical ${giftSearch}`, giftSearch].map((query) => searchShopping(query, brief, country, apiKey, signal)),
  );
  signal.throwIfAborted();
  const completed = results.filter((result) => result.status === "fulfilled");
  if (!completed.length) return { candidates: [], note: "SerpApi Google Shopping was unavailable." };

  const seen = new Set();
  const candidates = completed.flatMap(({ value }) => {
    const shortlist = [];
    for (const item of value) {
      const name = typeof item?.title === "string" ? item.title.trim() : "";
      if (!name) continue;
      const id = item.product_id || name.toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      shortlist.push({
        name: name.slice(0, 280),
        merchant: typeof item.source === "string" ? item.source.slice(0, 120) : null,
        listedPrice: typeof item.price === "string" ? item.price.slice(0, 80) : null,
        imageUrl: shoppingThumbnail(item.thumbnail)?.href,
      });
      if (shortlist.length === 4) break;
    }
    return shortlist;
  });
  const note = candidates.length
    ? `SerpApi Google Shopping supplied ${candidates.length} product ${candidates.length === 1 ? "lead" : "leads"}.`
    : "SerpApi Google Shopping returned no product leads.";
  return { candidates, note };
}
