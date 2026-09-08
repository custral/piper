# Pied Piper — a Custral demo

A Silicon-Valley-themed Next.js app showing two Custral surfaces working for
real:

- **Usage metering** — compressing a file fires `CustralUsage.track(...)`, and
  the event shows up in your workspace.
- **Live chat + scheduling** — every page embeds the real Custral chat widget.
  Conversations land in your workspace, replies stream back over a websocket,
  and visitors can book a meeting without leaving the chat.

## Quick start

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3010> and click **Connect Custral**. You'll get a short
code to approve in your browser; after that the demo runs against your own
workspace — it creates an application, mints its own keys, sets up a usage
module, and pulls real contacts to use as the demo accounts.

There is nothing to paste into a file.

### What connecting actually does

| Step | In your workspace |
| --- | --- |
| Sign in | Device login — you approve a code, exactly like `custral login` |
| Pick a workspace | Nothing yet |
| Provision | Creates an application named **Pied Piper Demo** and two keys |
| Pick two tables | Creates a usage module joining them |
| Finish | Creates a "Middle-Out Compression" product record; reads back a page of contacts |

Everything it creates is named, visible in your workspace, and yours to delete.
**Disconnect** on `/connect` revokes the session it was using.

### Keys

The demo mints two, and treats them differently:

- a **publishable** key (`pk_…`), passed to the browser — that is what a `pk_` is
  for, and it drives the chat widget and usage tracking;
- a **secret** key (`sk_…`), scoped to `objects:read records:read records:write
  usage:read usage:write` and never sent to the client.

Both live in `.data/store.json`, which is gitignored. Delete it to reset.

## Wiring it up by hand instead

Connecting is the easy path, not the only one. Copy `.env.local.example` to
`.env.local` and fill it in if you would rather point the demo at ids you
already have — the environment is used whenever no connection is present.

## What it's built on

| Package | Used for |
| --- | --- |
| [`@custral/widget`](https://www.npmjs.com/package/@custral/widget) | The chat bubble |
| [`@custral/js`](https://www.npmjs.com/package/@custral/js) | `CustralUsage.track(...)` |
| [`@custral/sdk`](https://www.npmjs.com/package/@custral/sdk) | Server-side reads — objects, records, usage events |

The device-login flow talks to `/v1` with plain `fetch` (`src/lib/custral-gateway.ts`),
because an SDK holds a key and this is the arc that produces one.

## Storage

Accounts, compression history and the connection live in `.data/store.json`. It
is not a database — the demo reads the whole thing, changes it, and writes it
back. Chat history is owned by Custral; it's a real conversation.

## Links

- [Custral docs](https://docs.custral.com)
- [Chat widget setup](https://docs.custral.com/comms/chat/widget-install)

MIT © Custral
