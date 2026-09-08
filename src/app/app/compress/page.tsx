import {redirect} from "next/navigation";

import {CompressionTool} from "@/components/compression-tool";
import {getActiveAccount} from "@/lib/active-account";
import {getAccountState} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CompressPage(): Promise<React.ReactElement> {
  const account = await getActiveAccount();
  if (!account) redirect("/");
  const state = await getAccountState(account.id);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Compress</h1>
        <p className="text-sm text-muted-foreground">
          Drop a file in. Each compression fires a usage event in your Custral workspace.
        </p>
      </header>
      <CompressionTool history={state?.compressions ?? []} />
    </div>
  );
}
