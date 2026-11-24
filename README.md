# Gift Search v2

Whether you’re looking for a Secret Santa gift or something unique for a family member, collaborate with agents to find ideas and refine your search.

## Try it

**[Try the chocolate demo](https://sriaradhyula.github.io/gift-search-agent-skill/dashboard.html?demo=chocolate)**. In the browser, select **Run demo** to watch two rounds of research. No account or API key required.

## Run a live search

Install Node.js 22.20 or later and sign in to Claude Code with `claude auth login`. [Get Node.js](https://nodejs.org/en/download) · [Set up Claude Code](https://code.claude.com/docs/en/setup)

```sh
git clone https://github.com/sriaradhyula/gift-search-agent-skill.git
cd gift-search-agent-skill
./runme.sh
```

Enter who you’re shopping for, the occasion, and your budget. Pick **Surprise me** for a starting point, then select **Find gifts**. The **Run with** picker also supports Codex, Cursor, OpenCode, and CAIPE. [Local setup and search options](docs/local-options.md)

Claude Code can search the web. To add Google Shopping results, save a SerpApi key in `~/.config/serpapi.txt`.

## Install the skill

Use Gift Search directly in Claude Code, Codex, Gemini CLI, OpenCode, or Cursor.

```sh
npx skills add sriaradhyula/gift-search-agent-skill --skill gift-search
```

Start a new session and ask your agent to use the skill.

> Find a creative Secret Santa gift for a coworker who loves dark chocolate. Keep it under $25 USD and check shipping to the United States.

The skill creates an HTML dashboard after each search, tries to open it in your browser, and gives you the link.

## How the agents collaborate

1. A planner creates scouts with different specialties for each research turn.
2. The scouts search in parallel and post their leads to shared research memory.
3. A reviewer checks price, stock, and shipping. The next turn uses that feedback to refine the shortlist.

Watch the handoffs in **Multi-agent Collaboration** and resume a previous search from **Search history**.

[Documentation](https://sriaradhyula.github.io/gift-search-agent-skill/) · [Architecture](https://sriaradhyula.github.io/gift-search-agent-skill/architecture.html) · [Apache 2.0 license](LICENSE)
