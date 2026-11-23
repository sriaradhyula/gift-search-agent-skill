# Gift Search v2

An installable skill and a live demo of how agents collaborate on a gift search. Claude assigns research specialists for each brief, and a reviewer posts what makes the shortlist. This project revisits the [Outshift holiday shopper walkthrough](https://outshift.cisco.com/blog/ai-ml/ai-holiday-shopper-multi-agent-gift-finder).

## Quick start

1. Install Node.js 22.20 or later with npm. Run the steps below in a terminal on macOS or Linux, or in WSL on Windows. [Download Node.js](https://nodejs.org/en/download)
2. Clone the repository with Git and start the demo. You can also download the repository as a ZIP, unzip it, and run the last command from that folder.

   ```sh
   git clone https://github.com/sriaradhyula/gift-search-agent-skill.git
   cd gift-search-agent-skill
   ./runme.sh --demo
   ```

3. In the browser, select **Try a demo**, choose a scenario, and select **Run demo**. If the browser stays closed, open the address printed in the terminal.

### Run your first live search

1. Stop the demo with **Ctrl+C**. For the default harness, install Claude Code and run `claude auth login`. If you prefer another harness, use its CLI setup below. [Claude Code setup](https://code.claude.com/docs/en/setup)
2. For Google Shopping discovery, save your SerpApi key as the only text in `~/.config/serpapi.txt`. Create the `~/.config` folder if needed. The launcher also supports an existing `SERPAPI_API_KEY` or `SERPAPI_API_KEY_FILE`. Claude Code can search with its web tools when a SerpApi key is unavailable. [Manage your SerpApi key](https://serpapi.com/manage-api-key)
3. Run `./runme.sh`, choose a harness under **Run with**, set the number of research turns, and select **Find gifts**. Use **Search history → Load run → Continue search** to add turns to a saved run.

The launcher serves the dashboard at `http://127.0.0.1:8000`. If that port is busy, try `./runme.sh --port 8001`. Use `--no-open` to keep browser launch manual. Press **Ctrl+C** to stop the server.

## Install

Run from your project with Node.js 22.20 or later and Git access to this repository.

```sh
npx skills add sriaradhyula/gift-search-agent-skill --skill gift-search
```

Choose your agent in the installer, or pass `-a` with its ID.

| Agent | ID |
| --- | --- |
| Claude Code | `claude-code` |
| Codex | `codex` |
| Gemini CLI | `gemini-cli` |
| OpenCode | `opencode` |
| Cursor | `cursor` |

Add `--global` to install across your projects. If you have a local clone, you can install from its absolute path.

```sh
npx skills add "/path/to/gift-search-agent-skill" --skill gift-search -a codex
```

Start a new agent session. The [skill instructions](skills/gift-search/SKILL.md) describe how to scout, verify, and rank listings, including a sequential workflow for hosts without delegation.

## Run the skill in Claude Code

In Claude Code, run:

```text
/gift-search Find a birthday gift for my sister. She loves coffee and slow mornings. Budget $75 USD, shipping to the United States.
```

Claude uses its own web tools to check retailer listings and summarizes the scouts’ contributions and the reviewer’s decisions. Ask for a dashboard if you want the report opened in your browser.

For Google Shopping discovery, set `SERPAPI_API_KEY` or put the key in a plain-text file at `~/.config/serpapi.txt`. Use `SERPAPI_API_KEY_FILE` to select another file. Claude can use its web tools for discovery when SerpApi is unavailable. If you already have the web dashboard open, ask Claude to open the results in that dashboard and give it the URL. [Agent dashboard commands](skills/gift-search/references/dashboard.md)

## Run with a local harness

Sign in to the CLI you want to use, then run the launcher from the checkout.

```sh
./runme.sh
```

Open [the local app](http://127.0.0.1:8000). **Run with** defaults to Claude Code and also offers Codex, Cursor, OpenCode, and CAIPE. Choose 1–5 **Research turns**, then select **Find gifts**. Clear **Search live retailers** to use the sample catalog. The local server gives the repo’s `SKILL.md` to each planner, scout, and reviewer in its own ACP session.

| Harness | Local setup |
| --- | --- |
| Claude Code | Sign in with `claude auth login`. The dashboard can start the pinned Claude ACP adapter. |
| Codex | Sign in with `codex login`. The dashboard can start the pinned Codex ACP adapter. |
| Cursor | Install the Cursor CLI and run `agent login`. The dashboard starts `agent acp`. |
| OpenCode | Install OpenCode and configure its model provider. The dashboard starts `opencode acp`. |
| CAIPE | Authenticate and configure your CAIPE CLI. Set `GIFT_CAIPE_AGENT` to select a particular accessible agent. The local CLI connects to your configured CAIPE endpoint. |

Each turn starts with new scout personas. The selected harness uses the shared board and earlier review decisions to choose their specialties, then the scouts research in parallel. The same retailer reviewer checks their leads and posts feedback across turns. The final shortlist combines verified findings from the run. **Download memory.md** records the personas for every turn.

Watch **Research memory** for scouts’ highlights, retailer decisions, and follow-up notes as they arrive. Select **All activity** to also see assignments and turn events. When the run finishes, the graph and console collapse and the memory stays visible beside the shortlist. **Replay last run** plays back the events in the current tab, and **Download memory.md** saves each turn’s personas and posts. **Stop research** leaves the notes posted so far available to download.

Open **Chat** in **Multi-agent Collaboration** to send a prompt on any topic, including while the agents are researching. The selected harness streams Markdown replies and can use the shortlist and board when you ask about the run. Press Enter to send or Shift+Enter for a new line.

When a SerpApi key is configured, the local server calls the Google Shopping API directly and passes the leads to every harness. The dashboard can search for and retrieve public retailer evidence for agents, and Claude Code can also use its native web tools. Every shortlist uses the same checks for the exact item, price, stock, destination, and budget. **Research leads** shows findings for items that did not qualify.

**Search history** saves new live runs in `~/.local/state/gift-search/runs` by default. Set `GIFT_HISTORY_DIR` to choose a different local folder. Load a run to see its results and memory, then select **Continue search** with 1–5 additional turns. The original brief and harness are reused. Interrupted runs restart from the last completed turn.

To keep the bridge running in tmux and watch its activity there, run:

```sh
tmux new-session -s gift-search 'GIFT_CLAUDE_CONSOLE=1 npm start'
```

## Try it

Start the dashboard in demo mode.

```sh
./runme.sh --demo
```

Open [the local app](http://127.0.0.1:8000), select **Try a demo**, and pick a scenario to run. The coffee, outdoor, and creative gift demos each show two research turns, with scouts using the reviewer’s feedback to revise the shortlist. Read the [skill guide](http://127.0.0.1:8000/guide.html) for per-agent commands or import the [sample report](docs/examples/coffee-birthday.json).

For a live search in your installed agent, try this prompt.

> Use the gift-search skill to find a birthday gift for my sister. She loves coffee and slow mornings. I can spend up to $75 USD, shipping to the United States. Write a gift-report.json I can open in the dashboard.

Select **Import results** to open the agent’s file. Agents can use the [report schema](skills/gift-search/references/report.schema.json) to prepare the export.

## Live web search from the dashboard

To use OpenAI for browser searches, set `OPENAI_API_KEY` and configure SerpApi as above. Run `npm run start:openai` and select **Search Google Shopping** in the gift brief. Two Google Shopping queries gather candidates for the destination and budget. OpenAI web search then opens the retailer pages to check the exact item, price, stock, and shipping. Verified products can include a Google Shopping thumbnail.

The shortlist excludes products when price, stock, or the shipping destination cannot be confirmed. It includes known shipping costs in the budget check and flags unknown shipping costs in the gift details. With only an OpenAI key, **Search live retailers** uses web search for both discovery and verification. Web discovery also runs as a fallback when Google Shopping is unavailable or returns no candidates. Both providers can bill for API calls. The keys stay on the local server. See [SerpApi’s Google Shopping API](https://serpapi.com/google-shopping-api) and [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search).

The OpenAI model defaults to `gpt-5-mini`. Set `OPENAI_GIFT_MODEL` to another reasoning model that supports web search and structured output. Set `PORT` to change the local port.

The `docs/` directory is ready for GitHub Pages. In the repository’s **Settings → Pages**, select **Deploy from a branch**, then choose the branch that contains the site and the **/docs** folder. The offline demos, sample catalog, skill guide, and report import and export run in the browser without credentials. Live harnesses, chat, and history use the local server. [GitHub Pages publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

After editing the dashboard, run `npm run build:dashboard` to refresh the HTML bundled with the skill.

## Update

For an install from GitHub, run `npx skills update gift-search`. For an install from a local checkout, pull the checkout and rerun the installer. See the [Skills CLI reference](https://github.com/vercel-labs/skills) for installation options.
