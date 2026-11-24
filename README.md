# Gift Search v2

Find creative White Elephant, Secret Santa, and family gifts. Collaborate with agents to explore ideas and refine your search.

## Try it

**[Try the chocolate demo](https://sriaradhyula.github.io/gift-search-agent-skill/dashboard.html?demo=chocolate)**. Select **Start demo** to watch two rounds of research. No account or API key required.

## Run a live search

Install Node.js 22.20 or later and sign in to Claude Code with `claude auth login`. [Get Node.js](https://nodejs.org/en/download) · [Set up Claude Code](https://code.claude.com/docs/en/setup)

```sh
git clone https://github.com/sriaradhyula/gift-search-agent-skill.git
cd gift-search-agent-skill
./runme.sh
```

Enter who you’re shopping for, the occasion, and your budget. Pick **Surprise me** for a starting point, then select **Find gifts**. The **Run with** picker also supports Codex, Cursor, OpenCode, and CAIPE. [Local setup and search options](docs/local-options.md)

Choose **Compare $25–$50 and $50–$100** when you want ideas at both price points. The comparison searches up to $100 USD and still includes lower-priced gifts.

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

Use **Refine search** in chat to review a new focus, edit the brief, and run another verified research turn.

[Documentation](https://sriaradhyula.github.io/gift-search-agent-skill/) · [Architecture](https://sriaradhyula.github.io/gift-search-agent-skill/architecture.html) · [Apache 2.0 license](LICENSE)
