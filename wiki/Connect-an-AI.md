# Connect an AI

CraftPages runs a local [MCP](https://modelcontextprotocol.io) server so an AI assistant
(Claude Code, OpenAI Codex, Cursor or any MCP client) can work on your site's templates
with you. The AI **proposes** changes; nothing is written until you accept them.

## Connect

1. Open **App settings → AI connection** (**Template editing (AI)** links there too).
2. Pick your AI tool and follow what it shows:
   - **Claude Code:** `claude mcp add-json craftpages …` (WebSocket,
     `ws://127.0.0.1:7424/mcp` by default).
   - **OpenAI Codex** (CLI, IDE extension or app): `codex mcp add craftpages --url …`
     (Streamable HTTP, `http://127.0.0.1:7424/mcp` by default).
   - **Claude Desktop** (and other tools that only start MCP servers as commands): copy the
     server entry into the tool's config. For Claude Desktop, that's **Settings → Developer →
     Edit Config** (`claude_desktop_config.json`); merge it into `mcpServers` if the file
     already has some, then quit and reopen Claude Desktop. The entry starts a small bridge
     that ships with CraftPages and runs on CraftPages' own binary, so nothing else needs
     installing. CraftPages has to be open while you use it.
   - **Other tools** (Cursor, VS Code…): add the server entry shown there to the tool's MCP
     servers. It's Streamable HTTP with the token as an `Authorization: Bearer` header; tools
     that can't set headers can add `?token=…` to the address.

   ChatGPT's chat connectors can't reach a server on your computer (OpenAI calls them from
   its own servers), so use Codex for OpenAI models.
3. When the client connects, a green dot appears next to **Template editing (AI)**.

## What the AI can do

- Read pages, CSS and page outlines; see what you clicked in the page editor; take
  screenshots of pages.
- Propose changes. Each proposal shows a diff and a live preview, and you **Accept** or
  **Reject** it. Accepted proposals can be reverted.
- Only on the project that is open: proposals must name it, and they are refused after you
  switch projects.

If you regenerate the token or change the port, copy the line or entry again: the old one
stops working.

## Security

The server listens on your computer only (127.0.0.1), requires a token (regenerate it in
**App settings**) and refuses requests from web pages. The port can be changed in
**App settings**, e.g. when another app uses 7424.
