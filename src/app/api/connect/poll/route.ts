import {NextResponse} from "next/server";

import {listOrganizations, pollDeviceToken} from "@/lib/custral-gateway";
import {mergePending, readPending} from "@/lib/store";

/**
 * Step 2 — poll until the browser approves.
 *
 * The client owns the loop so it can honour the interval and back off on
 * `slow_down`; this answers one poll. On success the session is stored
 * server-side and the caller gets the workspaces to choose from — never the
 * session itself.
 */
export async function POST(): Promise<NextResponse> {
  const pending = await readPending();
  if (!pending?.deviceCode) {
    return NextResponse.json({status: "expired", error: "Sign-in was not started."}, {status: 409});
  }

  const poll = await pollDeviceToken(pending.deviceCode);
  const result = poll.data;

  if (poll.ok && result?.ok && result.sessionId) {
    await mergePending({sessionId: result.sessionId, deviceCode: undefined});

    const orgs = await listOrganizations(result.sessionId);
    if (!orgs.ok || !orgs.data) {
      return NextResponse.json(
        {status: "error", error: "Signed in, but could not list your workspaces.", code: orgs.errorCode},
        {status: 502},
      );
    }
    return NextResponse.json({
      status: "ready",
      organizations: orgs.data.map((org) => ({id: org.id, name: org.name})),
    });
  }

  // `authorization_pending` is the ordinary case — the visitor has not approved
  // yet. Everything else is terminal enough to stop the client's loop.
  const code = result?.error ?? poll.errorCode;
  switch (code) {
    case "authorization_pending":
      return NextResponse.json({status: "pending"});
    case "slow_down":
      return NextResponse.json({status: "slow_down"});
    case "access_denied":
      return NextResponse.json({status: "denied", error: "Sign-in was denied in the browser."});
    case "expired_token":
      return NextResponse.json({status: "expired", error: "The code expired. Start again."});
    default:
      // A transient network blip — keep the client polling rather than failing
      // a sign-in that may still complete.
      return NextResponse.json({status: "pending"});
  }
}
