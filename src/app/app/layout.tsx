import {redirect} from "next/navigation";

import {AppShell} from "@/components/app-shell";
import {CustralChatWidgetMount} from "@/components/custral-chat-widget-mount";
import {getActiveAccount} from "@/lib/active-account";
import {readConnection} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AppLayout({children}: {children: React.ReactNode}): Promise<React.ReactElement> {
  const account = await getActiveAccount();
  if (!account) redirect("/");

  // The connected workspace's publishable key, or the hand-wired env var. Only
  // the `pk_` crosses to the client — the session and secret key stay here.
  const connection = await readConnection();
  const publishableKey = connection?.publishableKey ?? process.env.NEXT_PUBLIC_CUSTRAL_PUBLISHABLE_KEY;

  return (
    <>
      <AppShell account={account}>{children}</AppShell>
      {/* Live Custral website chat — floating bubble on every app page. */}
      <CustralChatWidgetMount
        publishableKey={publishableKey}
        channelId={process.env.NEXT_PUBLIC_CUSTRAL_CHANNEL_ID}
        baseUrl={process.env.NEXT_PUBLIC_CUSTRAL_API_BASE_URL}
        name={account.name}
        email={account.email}
      />
    </>
  );
}
