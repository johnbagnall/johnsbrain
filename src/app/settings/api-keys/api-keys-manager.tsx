"use client";
import * as React from "react";
import { format } from "date-fns";
import { Copy, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { createApiKeyAction, revokeApiKeyAction } from "@/lib/api-key-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export function ApiKeysManager({ keys: initialKeys }: { keys: KeyRow[] }) {
  const [keys, setKeys] = React.useState<KeyRow[]>(initialKeys);
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [revealedKey, setRevealedKey] = React.useState<{ name: string; plaintext: string } | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setKeys(initialKeys), [initialKeys]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    try {
      const created = await createApiKeyAction({ name: name.trim() });
      setRevealedKey({ name: created.name, plaintext: created.plaintext });
      setKeys((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          prefix: created.prefix,
          lastUsedAt: null,
          createdAt: created.createdAt.toISOString(),
          revokedAt: null,
        },
      ]);
      setName("");
    } catch (err) {
      toast.error("Failed to create key");
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  async function onRevoke(id: string) {
    if (!confirm("Revoke this key? It will stop working immediately.")) return;
    const prev = keys;
    setKeys((p) => p.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)));
    try {
      await revokeApiKeyAction({ id });
      toast.success("Key revoked");
    } catch (err) {
      toast.error("Failed to revoke");
      setKeys(prev);
      console.error(err);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            Use these keys to authenticate the MCP server. Pass as{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="api-key-name" className="sr-only">
                Key name
              </Label>
              <Input
                id="api-key-name"
                placeholder="e.g. Claude Desktop, Granola integration"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={pending}>
              <KeyRound className="h-4 w-4 mr-2" />
              {pending ? "Creating…" : "Create key"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys yet. Create one above.</p>
          ) : (
            <ul className="divide-y">
              {keys.map((k) => (
                <li key={k.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {k.name}
                      {k.revokedAt ? (
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">revoked</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                      <span className="font-mono">{k.prefix}…</span>
                      <span>created {format(new Date(k.createdAt), "MMM d, yyyy")}</span>
                      {k.lastUsedAt ? (
                        <span>last used {format(new Date(k.lastUsedAt), "MMM d, yyyy")}</span>
                      ) : (
                        <span>never used</span>
                      )}
                    </div>
                  </div>
                  {!k.revokedAt ? (
                    <Button variant="ghost" size="sm" onClick={() => onRevoke(k.id)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!revealedKey} onOpenChange={(o) => !o && setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              This is the only time you&apos;ll see the full key. Copy it now and store it somewhere safe.
            </DialogDescription>
          </DialogHeader>
          {revealedKey ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{revealedKey.name}</div>
              <div className="font-mono text-xs break-all rounded-md border bg-muted p-3 select-all">
                {revealedKey.plaintext}
              </div>
              <Button onClick={() => copyToClipboard(revealedKey.plaintext)} className="w-full">
                <Copy className="h-4 w-4 mr-2" /> Copy to clipboard
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
