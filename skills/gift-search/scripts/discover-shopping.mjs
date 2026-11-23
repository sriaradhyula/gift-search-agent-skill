import { readFileSync } from "node:fs";
import { validBrief } from "./report.mjs";
import { discoverShopping, readSerpApiKey } from "./shopping.mjs";

async function main() {
  let brief;
  try {
    const input = process.argv[2] ?? "-";
    brief = JSON.parse(readFileSync(input === "-" ? 0 : input, "utf8"));
  } catch {
    throw new Error("Pass a gift brief as a JSON file or on standard input.");
  }
  if (!validBrief(brief)) {
    throw new Error("Pass a valid gift brief with the required report fields.");
  }
  const apiKey = await readSerpApiKey();
  return apiKey
    ? discoverShopping(brief, apiKey, new AbortController().signal)
    : { candidates: [], note: "SerpApi is not configured." };
}

try {
  console.log(JSON.stringify(await main(), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
