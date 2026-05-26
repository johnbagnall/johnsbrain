# MCP server

This app exposes an MCP server so Claude (and any other MCP-compatible AI) can read and
write the cards on your Kanban board on your behalf — including, e.g., turning a meeting
note pulled from the Granola MCP into a list of to-dos.

## Endpoint

```
POST https://<your-domain>/api/mcp
Authorization: Bearer <your-api-key>
```

- Transport: **Streamable HTTP** (`@modelcontextprotocol/sdk` web-standard transport).
- Mode: **stateless** — one MCP session per HTTP request. No session cookies, no state
  between requests. Just send the JSON-RPC method on each request.
- Auth: `Authorization: Bearer <key>`, where `<key>` is what you copied from
  `/settings/api-keys`. Keys start with `kmcp_…`. Bad/missing key → `401`.
- Scope: each request runs as the user that owns the key. Tools only see that user's board.

## Adding it to Claude as a custom connector

In Claude (Desktop or web), open **Settings → Connectors → Add custom connector** and fill
in:

| Field | Value |
| --- | --- |
| Name | Kanban MCP (or whatever you like) |
| URL | `https://<your-domain>/api/mcp` |
| Transport | Streamable HTTP |
| Authentication | Bearer token |
| Token | `kmcp_…` (paste the value from `/settings/api-keys`) |

Save and enable it for the chat. Claude will discover the six tools below.

> Running locally? `http://localhost:3000/api/mcp` works for testing with Claude Desktop
> on the same machine. To use the connector from anywhere else, you'll need to expose the
> app on a public URL (a VPS + reverse proxy, a tunnel like `cloudflared tunnel`, etc.).

## Tools

| Tool | What it does |
| --- | --- |
| `list_columns` | Returns the user's columns: `id`, `name`, `position`. |
| `list_cards` | Returns the user's cards. Optional filters: `column_id`, `due_before`, `due_after` (all ISO 8601). |
| `create_card` | Args: `title` (required), `description?` (markdown), `column_id?` (defaults to leftmost), `due_date?` (ISO 8601). |
| `update_card` | Args: `id`, plus any of `title`, `description`, `due_date`. Pass `null` to clear `description`/`due_date`. |
| `move_card` | Args: `id`, `column_id`, `position` (0-indexed). Reorders other cards in the affected columns. |
| `delete_card` | Args: `id`. Returns `{ ok: true }`. |

Each tool has a Zod schema and a description, so Claude can pick the right one without
extra prompting.

## Example prompts

Once the connector is enabled, you can just ask Claude things like:

- *"Create three cards in my To Do column: research SQLite WAL mode, draft RFC for the
  metering API, email Lin about the migration window."*
- *"Show me everything due in the next 7 days."*
- *"Move the 'draft RFC' card to In Progress and bump its due date to Friday."*
- *"Here are my notes from this morning's standup. Make cards for any action items
  assigned to me."* (great alongside Granola — paste the notes, let Claude triage.)

## Curl smoke test

```bash
KEY="kmcp_..."
URL="https://your-domain.example.com/api/mcp"

# 1. Initialize the session (stateless mode still requires this handshake)
curl -sS -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'

# 2. List tools
curl -sS -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. Create a card in the default (leftmost) column
curl -sS -X POST "$URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"create_card","arguments":{"title":"Hello from curl","description":"# It works\n\n- yep"}}}'
```

## Security notes

- API keys are 256-bit base64url-encoded random tokens (prefixed `kmcp_`). The plaintext
  is shown once at creation and never persisted — only a SHA-256 digest is stored.
- Revoking a key sets `revoked_at` and the next request with that key returns 401.
- Every tool call goes through the same authorization checks as the web UI
  (`assertOwnColumn`, `loadCardForUser`) — a key for user A cannot touch user B's data.
- The endpoint deliberately does *not* use cookies, so it's not affected by CSRF and
  not constrained by SameSite.
