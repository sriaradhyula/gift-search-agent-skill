import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { isIP } from "node:net";
import { productUrl } from "../skills/gift-search/scripts/report.mjs";
import { searchCountry } from "../skills/gift-search/scripts/shopping.mjs";

const agentCoreEndpoint = process.env.GIFT_AGENTCORE_WEB_SEARCH_ENDPOINT?.trim();
const agentCoreRegion = process.env.GIFT_AGENTCORE_WEB_SEARCH_REGION?.trim();
export const usesAgentCoreSearch = Boolean(agentCoreEndpoint || agentCoreRegion);
if (usesAgentCoreSearch) {
  const endpoint = URL.canParse(agentCoreEndpoint) ? new URL(agentCoreEndpoint) : null;
  if (!agentCoreRegion || !endpoint || endpoint.protocol !== "https:" || endpoint.port ||
      !endpoint.hostname.endsWith(`.bedrock-agentcore.${agentCoreRegion}.vpce.amazonaws.com`) ||
      endpoint.origin !== agentCoreEndpoint.replace(/\/$/, "")) {
    throw new Error("Set the AgentCore Web Search region and its HTTPS interface endpoint DNS name.");
  }
}
let agentCoreClient;

export function retailerUrl(input) {
  const url = productUrl(input);
  const host = url?.hostname.replace(/\.$/, "");
  if (!host?.includes(".") || isIP(host) || /\.(local|localhost|internal|test|onion)$/.test(host) || url.port) return null;
  return url;
}

function publicAddress(ip) {
  if (isIP(ip) !== 4) return false;
  const [a, b] = ip.split(".").map(Number);
  return a > 0 && a < 224 && ![10, 127].includes(a)
    && !(a === 100 && b >= 64 && b < 128)
    && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31)
    && !(a === 192 && [0, 168].includes(b))
    && !(a === 198 && (b === 18 || b === 19));
}

async function openPublicPage(url, signal) {
  const { address } = await lookup(url.hostname, { family: 4 });
  signal.throwIfAborted();
  if (!publicAddress(address)) throw new Error("The retailer address is unavailable.");
  return new Promise((resolve, reject) => {
    // Pin the connection to the public address that was checked above.
    const request = get(url, {
      signal, family: 4, autoSelectFamily: false,
      lookup: (_host, _options, callback) => callback(null, address, 4),
      headers: { "User-Agent": "Gift Search/2.0", Accept: "text/html,application/xhtml+xml,text/plain" },
    }, (response) => {
      const { statusCode: status, headers } = response;
      if (status !== 200) {
        response.resume();
        resolve({ status, location: headers.location });
        return;
      }
      if (!/^(text\/(html|plain)|application\/xhtml\+xml)\b/i.test(headers["content-type"] ?? "")) {
        response.resume();
        resolve({ status, text: "" });
        return;
      }
      const chunks = [];
      let length = 0;
      response.on("error", reject);
      response.on("data", (chunk) => {
        length += chunk.length;
        if (length > 2_000_000) request.destroy(new Error("The retailer page is too large."));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ status, text: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
  });
}

function stripMarkup(text) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", dollar: "$" };
  return text.replace(/<[^>]+>/g, " ").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (raw, code) => {
    const number = code.startsWith("#x") ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
    return code.startsWith("#") && Number.isInteger(number) && number > 0 && number <= 0x10ffff
      ? String.fromCodePoint(number) : entities[code.toLowerCase()] ?? raw;
  }).replace(/\s+/g, " ").trim();
}

function pageExcerpt(html) {
  const structured = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim()).filter((text) => /product|offer|shipping/i.test(text)).join(" ").slice(0, 4000);
  const visible = html
    .replace(/<(script|style|svg|noscript|template|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ");
  const text = stripMarkup(visible);
  const details = [...text.matchAll(/in stock|out of stock|sold out|backorder|add to (bag|cart)|shipping|delivery|ships to|\$\d+\.\d{2}/gi)]
    .slice(0, 20).map(({ index }) => text.slice(Math.max(0, index - 45), index + 140));
  return { structured, text: [text.slice(0, 3800), ...details].filter(Boolean).join("\n") };
}

async function fetchRetailer(input, signal) {
  let url = retailerUrl(input);
  if (!url) return { error: "Enter a public HTTPS retailer URL." };
  const requestedUrl = url.href;
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(12_000)]);
  try {
    for (let step = 0; step < 4; step++) {
      const page = await openPublicPage(url, deadline);
      if ([301, 302, 303, 307, 308].includes(page.status) && page.location) {
        url = retailerUrl(new URL(page.location, url).href);
        if (!url) break;
        continue;
      }
      if (page.status !== 200 || !page.text) return { requestedUrl, status: page.status, error: "Retailer content unavailable." };
      const excerpt = pageExcerpt(page.text);
      const blocked = !excerpt.structured && /access denied|verify (that )?you are human|just a moment|captcha|request blocked/i.test(excerpt.text.slice(0, 450));
      if (blocked || !excerpt.text) return { requestedUrl, error: "Retailer content unavailable." };
      return { requestedUrl, url: url.href, ...excerpt };
    }
  } catch {
    if (signal.aborted) signal.throwIfAborted();
  }
  return { requestedUrl, error: "The retailer could not be opened." };
}

async function searchWeb(query, brief, key, signal) {
  if (usesAgentCoreSearch) {
    try {
      const { BedrockAgentCoreClient, InvokeWebSearchCommand } = await import("@aws-sdk/client-bedrock-agentcore");
      agentCoreClient ??= new BedrockAgentCoreClient({
        region: agentCoreRegion, endpoint: agentCoreEndpoint, maxAttempts: 2,
      });
      const { results = [] } = await agentCoreClient.send(new InvokeWebSearchCommand({
        webSearchId: "web-search.v1", searchQuery: [...query].slice(0, 200).join(""), maxResults: 6,
      }), { abortSignal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]) });
      return {
        query,
        results: results.filter(({ url }) => retailerUrl(url)).map(({ title, url, text }) => ({
          title: title ?? new URL(url).hostname, link: url, snippet: text.slice(0, 300),
        })),
      };
    } catch {
      if (signal.aborted) signal.throwIfAborted();
      return { query, error: "AgentCore Web Search was unavailable." };
    }
  }
  if (!key) return { query, error: "Google web search requires the local SerpApi key." };
  const url = new URL("https://serpapi.com/search");
  const country = searchCountry(brief.region)?.toLowerCase();
  url.search = new URLSearchParams({ engine: "google", q: query, hl: "en", api_key: key, ...(country && { gl: country === "gb" ? "uk" : country }) });
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
    if (response.ok) {
      const body = await response.json();
      const results = Array.isArray(body.organic_results) ? body.organic_results : [];
      if (!body.error) return {
        query,
        results: results.filter(({ link }) => retailerUrl(link)).slice(0, 6)
          .map(({ title, link, snippet }) => ({ title, url: link, snippet: String(snippet ?? "").slice(0, 300) })),
      };
    }
  } catch {
    if (signal.aborted) signal.throwIfAborted();
  }
  return { query, error: "Google web search was unavailable." };
}

export async function collectRetailerEvidence(lookups, { brief, key, signal, activity }) {
  const requests = [...new Set(lookups.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  return Promise.all(requests.map(async (input) => {
    const url = retailerUrl(input);
    const isPage = Boolean(url) || /^https?:\/\//i.test(input);
    const tool = isPage ? "Retailer page" : usesAgentCoreSearch ? "AgentCore Web Search" : "Web search";
    const detail = url ? url.hostname + url.pathname : input.slice(0, 200);
    activity({ kind: "claude-tool", tool, detail: detail.slice(0, 200), status: "pending" });
    const evidence = isPage ? await fetchRetailer(input, signal) : await searchWeb(input.slice(0, 220), brief, key, signal);
    activity({ kind: "claude-tool", tool, detail: detail.slice(0, 200), status: evidence.error ? "failed" : "completed" });
    return evidence;
  }));
}
