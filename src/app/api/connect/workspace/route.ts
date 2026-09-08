import {NextResponse} from "next/server";

import {createApplication, createApplicationKey} from "@/lib/custral-gateway";
import {listWorkspaceObjects} from "@/lib/custral-workspace";
import {mergePending, readPending} from "@/lib/store";

/** The scopes the demo needs, and nothing wider. */
const SECRET_KEY_SCOPES = ["objects:read", "records:read", "records:write", "usage:read", "usage:write"];

/**
 * Step 3 — the visitor picked a workspace.
 *
 * Creates an Application in it and mints two keys: the `pk_` the chat widget and
 * usage tracking run on, and an `sk_` for the server-side reads. Then returns
 * the workspace's objects so the next step can ask which hold customers and
 * products — a fresh workspace may have neither under a guessable name, so
 * asking beats guessing.
 *
 * `POST /v1/applications` mints a default `pk_`/`sk_` pair of its own, whose
 * plaintext it does not return — so those two are unreachable and these two are
 * minted beside them rather than instead of them. The demo's keys are the named
 * ones; the defaults are the platform's, and revoking the application takes all
 * four.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const pending = await readPending();
  if (!pending?.sessionId) {
    return NextResponse.json({error: "Not signed in. Start again."}, {status: 409});
  }

  const body = (await request.json()) as {orgId?: string; orgName?: string};
  const orgId = body.orgId?.trim();
  if (!orgId) return NextResponse.json({error: "Pick a workspace."}, {status: 400});

  const app = await createApplication({sessionId: pending.sessionId, orgId, name: "Pied Piper Demo"});
  if (!app.ok || !app.data) {
    return NextResponse.json(
      {error: "Could not create an application in that workspace.", code: app.errorCode},
      {status: 502},
    );
  }

  const publishable = await createApplicationKey({
    sessionId: pending.sessionId,
    orgId,
    applicationId: app.data.id,
    type: "publishable",
    name: "Pied Piper Demo (browser)",
  });
  const secret = await createApplicationKey({
    sessionId: pending.sessionId,
    orgId,
    applicationId: app.data.id,
    type: "secret",
    name: "Pied Piper Demo (server)",
    scopes: SECRET_KEY_SCOPES,
  });

  // The plaintext is returned exactly once, at mint. If either is missing there
  // is nothing to recover — fail here rather than half-connecting.
  const publishableKey = publishable.data?.key;
  const secretKey = secret.data?.key;
  if (!publishable.ok || !publishableKey || !secret.ok || !secretKey) {
    return NextResponse.json(
      {error: "Created the application but could not mint its keys.", code: secret.errorCode ?? publishable.errorCode},
      {status: 502},
    );
  }

  await mergePending({
    orgId,
    orgName: body.orgName?.trim() || orgId,
    applicationId: app.data.id,
    publishableKey,
    secretKey,
  });

  let objects;
  try {
    objects = await listWorkspaceObjects(secretKey);
  } catch {
    return NextResponse.json({error: "Could not read the workspace's objects."}, {status: 502});
  }

  return NextResponse.json({objects});
}
