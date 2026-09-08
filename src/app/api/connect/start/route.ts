import {NextResponse} from "next/server";
import {hostname} from "node:os";

import {startDeviceLogin} from "@/lib/custral-gateway";
import {mergePending} from "@/lib/store";

/**
 * Step 1 — begin device login.
 *
 * Returns the code the visitor types into Custral. The `deviceCode` is the
 * secret half and is kept server-side; only the short `userCode` and the
 * verification links reach the browser.
 */
export async function POST(): Promise<NextResponse> {
  const start = await startDeviceLogin(`Pied Piper Demo on ${hostname()}`);
  if (!start.ok || !start.data) {
    return NextResponse.json(
      {error: "Could not reach Custral to start sign-in.", code: start.errorCode, reqId: start.reqId},
      {status: 502},
    );
  }

  await mergePending({deviceCode: start.data.deviceCode, startedAt: new Date().toISOString()});

  return NextResponse.json({
    userCode: start.data.userCode,
    verificationUri: start.data.verificationUri,
    verificationUriComplete: start.data.verificationUriComplete,
    expiresIn: start.data.expiresIn,
    intervalMs: Math.max(1, start.data.interval || 5) * 1000,
  });
}
