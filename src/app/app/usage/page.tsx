import {redirect} from "next/navigation";
import {FileArchive, Activity} from "lucide-react";

import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {getActiveAccount} from "@/lib/active-account";
import {formatBytes} from "@/lib/compression";
import {getAccountState, readConnection} from "@/lib/store";
import {listWorkspaceUsageEvents} from "@/lib/custral-workspace";

export const dynamic = "force-dynamic";

export default async function UsagePage(): Promise<React.ReactElement> {
  const account = await getActiveAccount();
  if (!account) redirect("/");
  const state = await getAccountState(account.id);

  const compressions = state?.compressions ?? [];
  const totalBytes = compressions.reduce((sum, c) => sum + c.originalBytes, 0);

  // Read back what Custral actually recorded. Best-effort: a demo that cannot
  // reach the API should still show its local history rather than error out.
  const connection = await readConnection();
  let recorded: {count: number; units: number} | null = null;
  if (connection) {
    try {
      const events = await listWorkspaceUsageEvents({
        secretKey: connection.secretKey,
        moduleId: connection.usageModuleId,
        customerRecordId: account.customerRecordId,
      });
      recorded = {count: events.length, units: events.reduce((sum, e) => sum + e.quantity, 0)};
    } catch {
      recorded = null;
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Usage</h1>
        <p className="text-sm text-muted-foreground">
          Local mirror of events tracked for <strong>{account.name}</strong>. Open the matching usage block in your
          Custral workspace to see them flow in.
        </p>
      </header>

      <div className="mb-8 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        {connection ? (
          <>
            Each compression is sent to <strong>{connection.orgName}</strong> via{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">CustralUsage.track(...)</code>. Customer record:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{account.customerRecordId}</code>.
          </>
        ) : (
          <>
            Custral is not connected, so nothing is being metered.{" "}
            <a className="underline underline-offset-4" href="/connect">
              Connect a workspace
            </a>{" "}
            to see these events land for real.
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compressions</CardTitle>
            <FileArchive className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{compressions.length}</div>
            <p className="text-xs text-muted-foreground">events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bytes processed</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatBytes(totalBytes)}</div>
            <p className="text-xs text-muted-foreground">total compressed input</p>
          </CardContent>
        </Card>
      </div>

      {connection && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recorded in Custral</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {recorded ? (
              <>
                <div className="text-3xl font-bold">{recorded.count}</div>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(recorded.units)} metered against this contact, read back from your workspace
                </p>
              </>
            ) : (
              // The read failed — say so rather than showing a confident zero,
              // which would look like the tracking never landed.
              <p className="text-sm text-muted-foreground">
                Could not read usage back from Custral just now. The events above were still sent.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
