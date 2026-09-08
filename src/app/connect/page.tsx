import {ConnectFlow} from "@/components/connect-flow";
import {DisconnectButton} from "@/components/disconnect-button";
import {PiedPiperLogo} from "@/components/pied-piper-logo";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {readConnection} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ConnectPage(): Promise<React.ReactElement> {
  const connection = await readConnection();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3">
        <PiedPiperLogo size={56} />
        <h1 className="text-3xl font-bold tracking-tight">Pied Piper</h1>
      </div>

      {connection ? (
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Connected</CardTitle>
            <CardDescription>
              This demo is running against <strong>{connection.orgName}</strong>. Compress meters real usage, and the
              chat bubble opens conversations in that workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <a className="text-sm underline underline-offset-4" href="/">
              Start the demo
            </a>
            <DisconnectButton />
          </CardContent>
        </Card>
      ) : (
        <ConnectFlow />
      )}
    </main>
  );
}
