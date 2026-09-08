import {redirect} from "next/navigation";
import {ArrowDownRight, CalendarClock, MessageSquare, Sparkles} from "lucide-react";

import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {getActiveAccount} from "@/lib/active-account";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: MessageSquare,
    title: "Chat with the team",
    body: "Click the chat bubble in the bottom-right corner to start a conversation. It's the real Custral website-chat widget — the same one Pied Piper would drop onto piedpiper.com.",
  },
  {
    icon: Sparkles,
    title: "It links straight to Custral",
    body: "Every message lands as a conversation in the operator's Custral workspace, attributed to you. An agent's reply streams back into the bubble in real time over websockets.",
  },
  {
    icon: CalendarClock,
    title: "Book a meeting without leaving chat",
    body: "When scheduling is enabled on the workspace, the chat shows a “Book a meeting” action — pick an open slot and a calendar invite goes out to your email, all inside the conversation.",
  },
] as const;

export default async function ChatPage(): Promise<React.ReactElement> {
  const account = await getActiveAccount();
  if (!account) redirect("/");

  const configured = Boolean(process.env.NEXT_PUBLIC_CUSTRAL_PUBLISHABLE_KEY);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Pied Piper embeds the live <strong>Custral</strong> chat widget. Say hi as <strong>{account.name}</strong> and
          watch the conversation appear in the Custral workspace.
        </p>
      </header>

      {configured ? (
        <div className="mb-8 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          <ArrowDownRight className="h-4 w-4 shrink-0 text-primary" />
          Look for the chat bubble in the bottom-right corner — it's live on every page.
        </div>
      ) : (
        <div className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-muted-foreground">
          Set <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_CUSTRAL_PUBLISHABLE_KEY</code> in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> to light up the live chat bubble.
        </div>
      )}

      <div className="grid gap-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.title}>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
