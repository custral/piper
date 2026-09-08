"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Label} from "@/components/ui/label";

interface Organization {
  id: string;
  name: string;
}

interface WorkspaceObject {
  id: string;
  key?: string | null;
  name?: string | null;
}

type Stage = "idle" | "awaiting" | "workspace" | "objects" | "done";

interface StartResponse {
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  /** Seconds the device code is good for. The poll loop's deadline comes from this. */
  expiresIn: number;
  intervalMs: number;
  error?: string;
}

interface PollResponse {
  status: "pending" | "slow_down" | "ready" | "denied" | "expired" | "error";
  organizations?: Organization[];
  error?: string;
}

/**
 * Fallback for a start response that carried no `expiresIn` — the loop still
 * needs a bound, and this matches the gateway's own device-code lifetime.
 */
const DEFAULT_EXPIRES_IN_SECONDS = 600;

/** Best guess at which object holds people, so the pickers open on something sensible. */
function guessObject(objects: WorkspaceObject[], words: string[]): string {
  const match = objects.find((o) => words.some((w) => `${o.key ?? ""} ${o.name ?? ""}`.toLowerCase().includes(w)));
  return match?.id ?? objects[0]?.id ?? "";
}

function objectLabel(object: WorkspaceObject): string {
  return object.name || object.key || "Untitled object";
}

export function ConnectFlow(): React.ReactElement {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [start, setStart] = useState<StartResponse | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [objects, setObjects] = useState<WorkspaceObject[]>([]);
  const [customerObjectId, setCustomerObjectId] = useState("");
  const [productObjectId, setProductObjectId] = useState("");
  const [summary, setSummary] = useState<{orgName: string; accountsPulled: number} | null>(null);

  // The poll loop outlives a render, so it is torn down on unmount rather than
  // left running against a page nobody is looking at.
  const pollingRef = useRef(false);
  useEffect(() => () => void (pollingRef.current = false), []);

  const beginPolling = useCallback(async (intervalMs: number, expiresIn: number) => {
    pollingRef.current = true;
    let waitMs = intervalMs;

    // The loop needs a deadline of its own, not just the ref. The poll route
    // answers an unreachable API and any unrecognised code with `pending` so a
    // sign-in that may still complete is not failed on a blip — which, without
    // a deadline, is a browser polling forever against an API that is never
    // coming back. Same bound the CLI's device login uses.
    const deadline = Date.now() + Math.max(1, expiresIn || DEFAULT_EXPIRES_IN_SECONDS) * 1000;

    while (pollingRef.current && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      if (!pollingRef.current) return;

      let poll: PollResponse;
      try {
        poll = (await fetch("/api/connect/poll", {method: "POST"}).then((r) => r.json())) as PollResponse;
      } catch {
        continue; // a blip — the code has not expired yet, so keep waiting
      }

      if (poll.status === "ready") {
        pollingRef.current = false;
        setOrganizations(poll.organizations ?? []);
        setStage("workspace");
        return;
      }
      if (poll.status === "slow_down") {
        waitMs += 2000;
        continue;
      }
      if (poll.status === "denied" || poll.status === "expired" || poll.status === "error") {
        pollingRef.current = false;
        setError(poll.error ?? "Sign-in did not complete.");
        setStage("idle");
        return;
      }
    }

    // Fell out of the loop on the deadline (an unmount returns above), so the
    // code is dead. Say so rather than leaving "Waiting for approval" up.
    if (pollingRef.current) {
      pollingRef.current = false;
      setError("The code expired before it was approved. Start again.");
      setStage("idle");
    }
  }, []);

  const handleStart = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/connect/start", {method: "POST"});
      const data = (await response.json()) as StartResponse;
      if (!response.ok) {
        setError(data.error ?? "Could not reach Custral.");
        return;
      }
      setStart(data);
      setStage("awaiting");
      void beginPolling(data.intervalMs, data.expiresIn);
    } finally {
      setBusy(false);
    }
  }, [beginPolling]);

  const handlePickWorkspace = useCallback(async (org: Organization) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/connect/workspace", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({orgId: org.id, orgName: org.name}),
      });
      const data = (await response.json()) as {objects?: WorkspaceObject[]; error?: string};
      if (!response.ok || !data.objects) {
        setError(data.error ?? "Could not set up that workspace.");
        return;
      }
      setObjects(data.objects);
      setCustomerObjectId(guessObject(data.objects, ["contact", "customer", "people", "person", "user"]));
      setProductObjectId(guessObject(data.objects, ["product", "plan", "sku", "item"]));
      setStage("objects");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleFinish = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/connect/finish", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({customerObjectId, productObjectId}),
      });
      const data = (await response.json()) as {orgName?: string; accountsPulled?: number; error?: string};
      if (!response.ok) {
        setError(data.error ?? "Could not finish connecting.");
        return;
      }
      setSummary({orgName: data.orgName ?? "your workspace", accountsPulled: data.accountsPulled ?? 0});
      setStage("done");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [customerObjectId, productObjectId, router]);

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Connect Custral</CardTitle>
        <CardDescription>
          Sign in and this demo runs against your own workspace — real contacts, real usage, real chat. Nothing to paste
          into a file.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {stage === "idle" && (
          <Button onClick={handleStart} disabled={busy}>
            {busy ? "Starting…" : "Connect Custral"}
          </Button>
        )}

        {stage === "awaiting" && start && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Enter this code in Custral to approve the connection:</p>
            <p className="text-center font-mono text-3xl font-bold tracking-[0.3em]">{start.userCode}</p>
            <Button asChild>
              <a href={start.verificationUriComplete} target="_blank" rel="noreferrer">
                Open Custral to approve
              </a>
            </Button>
            <p className="text-center text-xs text-muted-foreground">Waiting for approval…</p>
          </div>
        )}

        {stage === "workspace" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Which workspace should the demo use?</p>
            {organizations.map((org) => (
              <Button key={org.id} variant="outline" disabled={busy} onClick={() => void handlePickWorkspace(org)}>
                {org.name}
              </Button>
            ))}
            {organizations.length === 0 && (
              <p className="text-sm text-muted-foreground">Your account has no workspaces yet.</p>
            )}
          </div>
        )}

        {stage === "objects" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Usage is metered against two of your tables. A new workspace may not have obvious ones, so pick them here.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer-object">Which table holds your customers?</Label>
              <select
                id="customer-object"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={customerObjectId}
                onChange={(event) => setCustomerObjectId(event.target.value)}
              >
                {objects.map((object) => (
                  <option key={object.id} value={object.id}>
                    {objectLabel(object)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-object">Which table holds your products?</Label>
              <select
                id="product-object"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={productObjectId}
                onChange={(event) => setProductObjectId(event.target.value)}
              >
                {objects.map((object) => (
                  <option key={object.id} value={object.id}>
                    {objectLabel(object)}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleFinish} disabled={busy || !customerObjectId || !productObjectId}>
              {busy ? "Setting up…" : "Finish"}
            </Button>
          </div>
        )}

        {stage === "done" && summary && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Connected to <strong>{summary.orgName}</strong>.
              {summary.accountsPulled > 0
                ? ` Pulled ${summary.accountsPulled} contact${summary.accountsPulled === 1 ? "" : "s"} to use as demo accounts.`
                : " That table had no records, so the demo kept its sample accounts."}
            </p>
            <Button asChild>
              <a href="/">Start the demo</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
