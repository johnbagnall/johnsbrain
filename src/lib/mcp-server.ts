import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as data from "./data";

function asTextResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function asError(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

function serializeCard(card: {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: card.id,
    column_id: card.columnId,
    title: card.title,
    description: card.description,
    due_date: card.dueDate ? card.dueDate.toISOString() : null,
    position: card.position,
    created_at: card.createdAt.toISOString(),
    updated_at: card.updatedAt.toISOString(),
  };
}

/**
 * Build a fresh MCP server scoped to a single user. We instantiate per-request
 * so the userId is captured by closure and tools cannot escape their scope.
 */
export function buildServerForUser(userId: string): McpServer {
  const server = new McpServer(
    { name: "kanban-mcp", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Personal Kanban board. Use list_columns to discover the board's columns, then list_cards / create_card / update_card / move_card / delete_card to manage to-dos.",
    },
  );

  server.registerTool(
    "list_columns",
    {
      title: "List columns",
      description:
        "List the columns on the user's board, in left-to-right order. Returns id, name, and position for each.",
      inputSchema: {},
    },
    async () => {
      const { columns } = await data.getBoardForUser(userId);
      return asTextResult(columns.map((c) => ({ id: c.id, name: c.name, position: c.position })));
    },
  );

  server.registerTool(
    "list_cards",
    {
      title: "List cards",
      description:
        "List cards on the user's board. Optionally filter by column, or by due-date range. Returned cards include all fields.",
      inputSchema: {
        column_id: z
          .string()
          .optional()
          .describe("If set, only return cards in this column."),
        due_before: z
          .string()
          .datetime({ offset: true })
          .optional()
          .describe("ISO 8601 datetime. Only return cards with due_date on or before this instant."),
        due_after: z
          .string()
          .datetime({ offset: true })
          .optional()
          .describe("ISO 8601 datetime. Only return cards with due_date on or after this instant."),
      },
    },
    async (args) => {
      const cards = await data.listCards(userId, {
        columnId: args.column_id,
        dueBefore: args.due_before ? new Date(args.due_before) : undefined,
        dueAfter: args.due_after ? new Date(args.due_after) : undefined,
      });
      return asTextResult(cards.map(serializeCard));
    },
  );

  server.registerTool(
    "create_card",
    {
      title: "Create card",
      description:
        "Create a new card. Defaults to the leftmost column (usually 'To Do') unless column_id is given. due_date is ISO 8601.",
      inputSchema: {
        title: z.string().min(1).max(500).describe("Card title. Required."),
        description: z
          .string()
          .max(10_000)
          .optional()
          .describe("Optional markdown description."),
        column_id: z
          .string()
          .optional()
          .describe("Target column id. Defaults to the leftmost column."),
        due_date: z
          .string()
          .datetime({ offset: true })
          .optional()
          .describe("Optional due date as ISO 8601."),
      },
    },
    async (args) => {
      try {
        const card = await data.createCard(userId, {
          title: args.title,
          description: args.description ?? null,
          columnId: args.column_id,
          dueDate: args.due_date ? new Date(args.due_date) : null,
        });
        return asTextResult(serializeCard(card));
      } catch (e) {
        return asError(e instanceof Error ? e.message : "Failed to create card");
      }
    },
  );

  server.registerTool(
    "update_card",
    {
      title: "Update card",
      description:
        "Update any subset of a card's fields. Only provided fields are changed. To clear description or due_date, pass null.",
      inputSchema: {
        id: z.string().describe("Card id to update."),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(10_000).nullable().optional(),
        due_date: z.string().datetime({ offset: true }).nullable().optional(),
      },
    },
    async (args) => {
      try {
        const card = await data.updateCard(userId, args.id, {
          title: args.title,
          description: args.description === undefined ? undefined : args.description,
          dueDate:
            args.due_date === undefined ? undefined : args.due_date ? new Date(args.due_date) : null,
        });
        return asTextResult(serializeCard(card));
      } catch (e) {
        return asError(e instanceof Error ? e.message : "Failed to update card");
      }
    },
  );

  server.registerTool(
    "move_card",
    {
      title: "Move card",
      description:
        "Move a card to a (column, position). position is zero-indexed within the destination column. Other cards are shifted to make room.",
      inputSchema: {
        id: z.string().describe("Card id to move."),
        column_id: z.string().describe("Destination column id."),
        position: z.number().int().min(0).describe("Zero-indexed position in destination column."),
      },
    },
    async (args) => {
      try {
        const card = await data.moveCard(userId, args.id, args.column_id, args.position);
        return asTextResult(serializeCard(card));
      } catch (e) {
        return asError(e instanceof Error ? e.message : "Failed to move card");
      }
    },
  );

  server.registerTool(
    "delete_card",
    {
      title: "Delete card",
      description: "Permanently delete a card. Returns { ok: true } on success.",
      inputSchema: { id: z.string().describe("Card id to delete.") },
    },
    async (args) => {
      try {
        await data.deleteCard(userId, args.id);
        return asTextResult({ ok: true });
      } catch (e) {
        return asError(e instanceof Error ? e.message : "Failed to delete card");
      }
    },
  );

  return server;
}
