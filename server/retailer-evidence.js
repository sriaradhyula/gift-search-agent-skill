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

const pageTypes = /^(text\/(html|plain)|application\/xhtml\+xml)$/i;
const thumbnailTypes = /^image\/(jpeg|png|webp)$/i;
const pageRequest = { accept: "text/html,application/xhtml+xml,text/plain", types: pageTypes, maxBytes: 2_000_000 };
const thumbnailRequest = { accept: "image/webp,image/jpeg,image/png", types: thumbnailTypes, maxBytes: 1024 * 1024 };

async function openPublicResource(url, signal, { accept, types, maxBytes }) {
  const { address } = await lookup(url.hostname, { family: 4 });
  signal.throwIfAborted();
  if (!publicAddress(address)) throw new Error("The retailer address is unavailable.");
  return new Promise((resolve, reject) => {
    // Pin the connection to the public address that was checked above.
    const request = get(url, {
      signal, family: 4, autoSelectFamily: false,
      lookup: (_host, _options, callback) => callback(null, address, 4),
      headers: { "User-Agent": "Gift Search/2.0", Accept: accept },
    }, (response) => {
      const { statusCode: status, headers } = response;
      if (status !== 200) {
        response.resume();
        resolve({ status, location: headers.location });
        return;
      }
      const type = headers["content-type"]?.split(";")[0].trim().toLowerCase() ?? "";
      if (!types.test(type)) {
        response.resume();
        resolve({ status });
        return;
      }
      const chunks = [];
      let length = 0;
      response.on("error", reject);
      response.on("data", (chunk) => {
        length += chunk.length;
        if (length > maxBytes) request.destroy(new Error("The retailer response is too large."));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ status, type, body: Buffer.concat(chunks) }));
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

async function fetchPublicResource(input, signal, options) {
  let url = retailerUrl(input);
  if (!url) return { error: "Enter a public HTTPS retailer URL." };
  const requestedUrl = url.href;
  try {
    for (let step = 0; step < 4; step++) {
      const page = await openPublicResource(url, signal, options);
      if ([301, 302, 303, 307, 308].includes(page.status) && page.location) {
        url = retailerUrl(new URL(page.location, url).href);
        if (!url) break;
        continue;
      }
      if (page.status !== 200 || !page.body?.length) return { requestedUrl, status: page.status, error: "Retailer content unavailable." };
      return { requestedUrl, url: url.href, ...page };
    }
  } catch {}
  return { requestedUrl, error: "The retailer could not be opened." };
}

async function fetchRetailer(input, signal) {
  const page = await fetchPublicResource(input, AbortSignal.any([signal, AbortSignal.timeout(12_000)]), pageRequest);
  signal.throwIfAborted();
  if (page.error) return page;
  const excerpt = pageExcerpt(page.body.toString("utf8"));
  const blocked = !excerpt.structured && /access denied|verify (that )?you are human|just a moment|captcha|request blocked/i.test(excerpt.text.slice(0, 450));
  if (blocked || !excerpt.text) return { requestedUrl: page.requestedUrl, error: "Retailer content unavailable." };
  return { requestedUrl: page.requestedUrl, url: page.url, ...excerpt };
}

export function retailerThumbnailUrl(html, pageUrl) {
  function resolveImage(value) {
    return typeof value === "string" && value.trim() && URL.canParse(value, pageUrl)
      ? retailerUrl(new URL(value, pageUrl).href) : null;
  }
  const images = new Map();
  for (const [, tag] of html.split(/<\/head\s*>/i, 1)[0].matchAll(/<meta\b((?:"[^"]*"|'[^']*'|[^"'<>])*)>/gi)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(([, name, quoted, single]) => [name.toLowerCase(), quoted ?? single]));
    const property = attrs.property?.toLowerCase();
    if (!["og:image:secure_url", "og:image"].includes(property) || !attrs.content || images.has(property)) continue;
    const image = resolveImage(stripMarkup(attrs.content));
    if (image) images.set(property, image);
  }
  const preview = images.get("og:image:secure_url") ?? images.get("og:image");
  if (preview) return preview;

  for (const [, contents] of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(contents);
    } catch {
      continue;
    }
    const entries = [data].flatMap((entry) => Array.isArray(entry?.["@graph"]) ? entry["@graph"] : entry);
    for (const entry of entries) {
      if (![entry?.["@type"]].flat().some((type) => type === "Product" || type === "https://schema.org/Product")) continue;
      for (const value of [entry.image].flat()) {
        const image = resolveImage(value?.contentUrl ?? value?.url ?? value);
        if (image) return image;
      }
    }
  }
  return null;
}

function imageSignatureMatches(type, body) {
  if (type === "image/jpeg") return body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (type === "image/png") return body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return type === "image/webp" && body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP";
}

export async function fetchRetailerThumbnail(product, signal) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(6_000)]);
  const page = await fetchPublicResource(product, deadline, pageRequest);
  if (!page.body) return null;
  const image = retailerThumbnailUrl(page.body.toString("utf8"), page.url);
  if (!image) return null;
  const { type, body } = await fetchPublicResource(image.href, deadline, thumbnailRequest);
  return body && imageSignatureMatches(type, body) ? { type, body } : null;
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
