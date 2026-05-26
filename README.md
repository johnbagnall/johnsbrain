# Kanban MCP

A self-hosted, personal Kanban to-do app — with a **built-in MCP server** so Claude (or any
MCP-compatible AI) can read and write cards on your behalf.

- **Framework**: Next.js 16 (App Router, Server Actions, React 19)
- **UI**: shadcn-style components on Tailwind v4
- **Auth**: Better Auth (email + password, cookie sessions)
- **Database**: SQLite + Drizzle ORM (single file, mounted as a Docker volume)
- **Drag & drop**: `@dnd-kit/core` with touch sensors
- **MCP**: `@modelcontextprotocol/sdk` over Streamable HTTP at `/api/mcp`

See [MCP.md](./MCP.md) for how to plug it into Claude.

---

## Local development

Prerequisites: Node 22+ (Node 24 works), npm.

```bash
cp .env.example .env.local
# Edit .env.local — at minimum, set BETTER_AUTH_SECRET to a 32+ char random string.
#   openssl rand -base64 32

npm install
npm run db:migrate     # creates ./data/app.db and applies the schema
npm run dev
```

Then open <http://localhost:3000>.

On first sign-up, your board is created with three default columns (**To Do**, **In Progress**,
**Done**). From there you can rename/add/delete columns, drag cards between them, and edit
cards (markdown descriptions, due dates).

### Mobile

The board uses horizontal scroll with scroll-snap on narrow viewports — each column is ~85% of
the viewport width, swipe between them. Card edit opens in a bottom sheet on phones and a
centered dialog on desktop. Tap targets are 44px+ throughout. Test at 375px.

### Useful scripts

| Script               | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Next dev server on :3000                                  |
| `npm run build`      | Production build (standalone output)                      |
| `npm run start`      | Run the production build locally                          |
| `npm run db:generate`| Generate a new Drizzle migration from the schema          |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL`                |
| `npm run db:studio`  | Open Drizzle Studio against the local DB                  |
| `npm run test:e2e`   | Run the Playwright happy-path test                        |
| `npm run lint`       | Lint                                                      |

---

## Deploying with Docker

A multi-stage `Dockerfile` and `docker-compose.yml` are included. The SQLite database lives
on a named volume (`todo-data`) mounted at `/data`, so your data survives container restarts
and rebuilds.

### Quick start (Docker Compose)

```bash
cp .env.example .env
# Edit .env — set BETTER_AUTH_SECRET and BETTER_AUTH_URL.

docker compose up -d --build
# App is live at the BETTER_AUTH_URL you set (default http://localhost:3000).
```

The entrypoint applies pending Drizzle migrations against the mounted DB on every boot, so
deploying a new image is just `docker compose pull && docker compose up -d`.

### Deploying to a VPS

1. SSH into the box; install Docker Engine + the Compose plugin.
2. Clone this repo (or copy `Dockerfile`, `docker-compose.yml`, and `.env`).
3. Set `BETTER_AUTH_URL` to the public URL the app will be served at (e.g.
   `https://todo.example.com`).
4. Put a reverse proxy in front of it (Caddy/Nginx) terminating TLS and forwarding to
   `:3000`. Better Auth issues secure cookies and needs `BETTER_AUTH_URL` to match the URL
   the browser actually sees.
5. `docker compose up -d --build`.

Backing up = backing up the `todo-data` volume (or just the `/data/app.db*` files).

---

## How auth works

- **Web UI**: Better Auth's email/password provider. Sign up creates a user, an account row
  with the password hash, and a default board with three columns. Sessions are cookie-based.
- **MCP**: Bearer tokens. Generate one at `/settings/api-keys`. The plaintext is shown once
  at creation; only a SHA-256 hash is stored. Pass as
  `Authorization: Bearer kmcp_…` to `/api/mcp`. Revoking the key takes effect immediately.

The "forgot password" flow has a UI and a route, but the email-send step is a no-op stub —
wire up a transactional email provider in `src/lib/auth.ts:sendResetPassword` before relying
on it in production.

---

## Generating an API key for Claude

1. Sign in to the app.
2. Go to **API keys** in the avatar menu (or `/settings/api-keys`).
3. Click **Create key**, give it a name, and copy the full key from the dialog. You will
   only see it once.
4. Add the MCP server to Claude — see [MCP.md](./MCP.md).

---

## Project layout

```
src/
  app/
    (auth)/                  # sign-in, sign-up, forgot/reset password
    api/auth/[...all]/       # Better Auth handler
    api/mcp/                 # MCP Streamable HTTP endpoint
    board/                   # the Kanban board
    settings/                # account + API keys
  components/
    board/                   # Board, Column, CardItem, CardEditor
    ui/                      # shadcn-style primitives
  lib/
    db/                      # Drizzle schema + connection + migrator
    auth.ts                  # Better Auth server
    auth-client.ts           # Better Auth React client
    data.ts                  # board/column/card queries (pure, take userId)
    actions.ts               # Server Actions wrapping data.ts
    api-keys.ts              # API key gen/hash/lookup
    api-key-actions.ts       # Server Actions for /settings/api-keys
    mcp-server.ts            # builds an MCP server scoped to one user
  proxy.ts                   # route protection (Next 16's replacement for middleware)
drizzle/                     # generated SQL migrations
```

`src/lib/data.ts` is the single source of truth for board mutations — both Server Actions
and the MCP tools call into it, so the UI and the AI cannot diverge.

---

## What's intentionally out of scope (v1)

- Multi-board per user
- Sharing, collaboration, org accounts
- Notifications, reminders, email
- File attachments, comments, subtasks, labels
- Real password-reset email delivery (the route + UI exists; just `sendResetPassword`
  is a stub)
