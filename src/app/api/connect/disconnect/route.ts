import {NextResponse} from "next/server";

import {deactivateApplicationKey, listApplicationKeys, logoutSession} from "@/lib/custral-gateway";
import {clearConnection, clearPending, readConnection, readPending} from "@/lib/store";

/**
 * Hands back everything Connect was given, then forgets it.
 *
 * There are TWO credentials, and only one of them expires. The session is a
 * device login; the `pk_`/`sk_` pair minted onto the demo's application never
 * expires at all, so dropping those locally would leave live keys in a real
 * workspace that nothing here can reach again. Both are revoked, keys first —
 * revoking the session is what takes away the ability to revoke the keys.
 *
 * Every step is best-effort and the local state is cleared regardless: a
 * credential that cannot be handed back must not also stay pinned in a demo's
 * store file, where it is neither usable nor visible.
 */
export async function POST(): Promise<NextResponse> {
  const connection = await readConnection();
  const pending = await readPending();
  const sessionId = connection?.sessionId ?? pending?.sessionId;
  const orgId = connection?.orgId ?? pending?.orgId;
  const applicationId = connection?.applicationId ?? pending?.applicationId;

  let keysRevoked = 0;
  if (sessionId && orgId && applicationId) {
    const keys = await listApplicationKeys({sessionId, orgId, applicationId});
    for (const key of keys.data ?? []) {
      if (!key.id) continue;
      const result = await deactivateApplicationKey({sessionId, orgId, applicationId, keyId: key.id});
      if (result.ok) keysRevoked += 1;
    }
  }

  let revoked = false;
  if (sessionId) {
    const result = await logoutSession(sessionId);
    revoked = result.ok;
  }

  await clearConnection();
  await clearPending();

  return NextResponse.json({disconnected: true, revoked, keysRevoked});
}
