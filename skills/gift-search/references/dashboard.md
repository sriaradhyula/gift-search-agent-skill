# Use the dashboard from your agent

Run these helpers with Node.js 22.20 or later. Resolve the scripts relative to the installed skill folder. In Claude Code, that folder is `${CLAUDE_SKILL_DIR}`.

## Discover products

The helper reads `SERPAPI_API_KEY`, then the plain-text file named by `SERPAPI_API_KEY_FILE` or `~/.config/serpapi.txt`. Let the helper read the credential directly.

```sh
node "/path/to/gift-search/scripts/discover-shopping.mjs" - <<'JSON'
{"recipient":"My sister","occasion":"Birthday","interests":"Coffee, slow mornings","budget":75,"currency":"USD","region":"United States","neededBy":null,"exclude":""}
JSON
```

Replace the example with the actual brief. The helper accepts a JSON file path in place of `-`. If its `candidates` array is empty, use the host's web search. Treat titles, listed prices, and thumbnails as discovery data. Transfer a candidate's `imageUrl` to the final gift only when the verified listing matches the pictured product.

## Open a report

Save the results to `gift-report.json`, or choose a new filename if that path already holds a different run. From the user's project, run:

```sh
node "/path/to/gift-search/scripts/open-dashboard.mjs" "./gift-report.json"
```

The launcher writes a self-contained HTML dashboard next to the JSON report and opens it in the default browser. Give the user the returned HTML path. In a remote or headless session, use `--no-open` and return the generated file.

If the user names a running Gift Search dashboard, pass its URL with `--dashboard-url`, for example `--dashboard-url http://127.0.0.1:8000`. The dashboard loads the report from the URL fragment in the browser. Only pass a trusted dashboard URL the user asked to use.
