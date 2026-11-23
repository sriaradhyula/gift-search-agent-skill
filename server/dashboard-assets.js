import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const files = new Set([
  "dashboard.html", "guide.html", "architecture.html", "styles.css", "site.css", "dashboard.js", "guide.js", "report.js", "sample.js", "demos.js", "team.js", "chat.js", "share.js",
  "assets/catalog.webp", "assets/christmas-gifts.webp", "assets/markdown-it.min.js", "examples/coffee-birthday.json",
]);
const mime = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webp": "image/webp",
};

export async function readDashboardAsset(path, basePath) {
  if (!path.startsWith("/")) return null;
  const file = path === "/" || path === "/index.html" ? "dashboard.html" : path.slice(1);
  if (!files.has(file)) return null;
  const type = mime[extname(file)];
  const source = await readFile(new URL(`../docs/${file}`, import.meta.url));
  const content = basePath && file === "dashboard.html"
    ? Buffer.from(source.toString("utf8")
      .replace("<head>", `<head>\n  <meta name="gift-search-mount" content="${basePath}">`)
      .replaceAll(/(href|src)="\.\//g, `$1="${basePath}/`))
    : source;
  return { type, content };
}
