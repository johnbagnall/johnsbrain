import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiKey } from "@/lib/api-keys";
import { buildServerForUser } from "@/lib/mcp-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonRpcUnauthorized(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: missing or invalid API key" },
      id: null,
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="kanban-mcp"',
      },
    },
  );
}

async function authenticate(req: Request): Promise<{ userId: string } | null> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const result = await authenticateApiKey(m[1].trim());
  return result ? { userId: result.userId } : null;
}

async function handle(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return jsonRpcUnauthorized();

  // Stateless: one transport + server per request. The userId is captured by
  // closure inside the server, so tools cannot cross-contaminate users.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildServerForUser(auth.userId);
  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } finally {
    // Best-effort cleanup; per-request resources are short-lived.
    transport.close().catch(() => {});
    server.close().catch(() => {});
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
