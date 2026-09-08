import {AccountPicker} from "@/components/account-picker";
import {PiedPiperLogo} from "@/components/pied-piper-logo";
import {listAccounts, readConnection} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<React.ReactElement> {
  const accounts = await listAccounts();
  const connection = await readConnection();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-8">
      <div className="flex flex-col items-center gap-4">
        <PiedPiperLogo size={72} />
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight">Pied Piper</h1>
          <p className="mt-2 text-muted-foreground">Choose a Pied Piper teammate to continue</p>
        </div>
      </div>
      <AccountPicker accounts={accounts} />

      {connection ? (
        <p className="text-xs text-muted-foreground">
          Connected to <strong>{connection.orgName}</strong> ·{" "}
          <a className="underline underline-offset-4" href="/connect">
            manage
          </a>
        </p>
      ) : (
        // Unconnected the demo still runs, but on sample accounts that exist in
        // no workspace — so nothing it does shows up anywhere. Say that here
        // rather than letting people find out from a silent usage page.
        <div className="max-w-md rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-center text-sm text-muted-foreground">
          These are sample accounts, so nothing is being recorded.{" "}
          <a className="font-medium underline underline-offset-4" href="/connect">
            Connect Custral
          </a>{" "}
          to run the demo against your own workspace.
        </div>
      )}
    </main>
  );
}
