# Local setup and search options

Start the dashboard from a checkout with Node.js 22.20 or later.

```sh
./runme.sh
```

Use `./runme.sh --demo` for offline samples, `--port 8001` if port 8000 is busy, or `--no-open` to open the printed address yourself.

## Run with a local harness

Sign in to your CLI before launching the dashboard. Pick your harness under **Run with**.

| Harness | Setup |
| --- | --- |
| Claude Code | Run `claude auth login`. The dashboard can start the Claude ACP adapter. |
| Codex | Run `codex login`. The dashboard can start the Codex ACP adapter. |
| Cursor | Install the Cursor CLI and run `agent login`. |
| OpenCode | Install OpenCode and configure its model provider. |
| CAIPE | Connect the CAIPE CLI to your endpoint. Set `GIFT_CAIPE_AGENT` to select an accessible agent. |

Choose 1–5 research turns. **Search history** saves live runs in `~/.local/state/gift-search/runs` by default. Set `GIFT_HISTORY_DIR` to override it. Use **Continue search** to pick up from the last completed turn. Each turn has new scout personas. **Download memory.md** saves their assignments and posts.

Use **Chat with Gift Search Agent** at the bottom right to message the selected harness during a run. To watch bridge activity in tmux, use `tmux new-session -s gift-search 'GIFT_CLAUDE_CONSOLE=1 npm start'`.

## Install the skill for a particular agent

Select an agent in the installer or pass `-a` with `claude-code`, `codex`, `gemini-cli`, `opencode`, or `cursor`. Add `--global` to install across projects. To install from a checkout, replace the GitHub repo name with its absolute path.

Run `npx skills update gift-search` to update an install from GitHub. For local installs, pull the checkout and rerun the installer. See the [Skills CLI options](https://github.com/vercel-labs/skills).

The installed skill creates and links an HTML dashboard after each search. Use the [dashboard launcher](../skills/gift-search/references/dashboard.md#open-a-report) to reopen a saved JSON report.

## Search providers

Claude Code can use web search to find gifts and check retailer details. Set `SERPAPI_API_KEY` or save a key in `~/.config/serpapi.txt` to add Google Shopping discovery. Set `SERPAPI_API_KEY_FILE` to read another file. The shortlisted items must meet the brief’s budget, stock, and destination checks.

For the separate OpenAI mode, install dependencies with `npm ci`, set `OPENAI_API_KEY`, and run `npm run start:openai`. It uses web search with optional Google Shopping leads. Set `OPENAI_GIFT_MODEL` to override the default `gpt-5-mini` with a compatible model. Provider calls can incur charges. [Google Shopping API](https://serpapi.com/google-shopping-api)

## Publish or develop

The `docs/` directory can be published with [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). Offline demos run in the browser. Live searches, chat, and history use a server. See the [Grid deployment guide](../deploy/grid/README.md) for hosted deployment.

After editing the dashboard, run `npm run build:dashboard` to update the HTML bundled with the skill.
