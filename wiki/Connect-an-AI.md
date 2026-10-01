# Connect an AI

CraftPages runs a local [MCP](https://modelcontextprotocol.io) server so an AI assistant
(Claude Code, Claude Desktop, Cursor or any MCP client) can work on your site's templates
with you. The AI **proposes** changes; nothing is written until you accept them.

## Connect

1. Open **Template editing (AI)** in the sidebar.
2. Copy the `claude mcp add-json craftpages …` line and run it once in a terminal (for
   Claude Code). Other clients: use the address and token shown there
   (`ws://127.0.0.1:7424/mcp` by default).
3. When the client connects, a green dot appears next to **Template editing (AI)**.

## What the AI can do

- Read pages, CSS and page outlines; see what you clicked in the page editor; take
  screenshots of pages.
- Propose changes. Each proposal shows a diff and a live preview, and you **Accept** or
  **Reject** it. Accepted proposals can be reverted.
- Only on the project that is open: proposals must name it, and they are refused after you
  switch projects.

## Security

The server listens on your computer only (127.0.0.1), requires a token (regenerate it in
**App settings**) and refuses requests from web pages. The port can be changed in
**App settings**, e.g. when another app uses 7424.
