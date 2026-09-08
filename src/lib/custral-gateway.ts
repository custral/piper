import "server-only";

/**
 * Piper's client for Custral's `/v1` gateway.
 *
 * Two auth modes, because the bootstrap arc cannot use the thing it produces:
 *
 * - **Session** — the device-login flow. `Authorization: <sessionId>` verbatim,
 *   no `Bearer` prefix (that is how the gateway's bootstrap tier reads it), plus
 *   an `Organization` header once a workspace is chosen. Used only until a key
 *   exists.
 * - **Key** — everything after. `@custral/sdk` handles those; see
 *   `custral-workspace.ts`.
 *
 * `server-only` is load-bearing: this module handles a session id and a secret
 * key, and importing it from a client component must be a build error rather
 * than a leak.
 */

export const CUSTRAL_API_URL = process.env.CUSTRAL_API_BASE_URL?.replace(/\/+$/, "") ?? "https://api.custral.com";

/** The `{data, error, reqId}` envelope, unwrapped. */
interface GatewayResult<T> {
  ok: boolean;
  data: T | null;
  errorCode: string | null;
  reqId: string | null;
}

function unwrap<T>(status: number, body: unknown): GatewayResult<T> {
  const b = body as {data?: T; error?: {code?: string}; reqId?: string} | null;
  const isEnvelope = !!b && typeof b === "object" && ("data" in b || "error" in b);
  if (isEnvelope) {
    const errorCode = b!.error?.code ?? null;
    // The gateway answers HTTP 200 with the failure inside `error`, so status
    // alone is not the signal.
    return {ok: status < 400 && !errorCode, data: b!.data ?? null, errorCode, reqId: b!.reqId ?? null};
  }
  return {ok: status < 400, data: (body as T) ?? null, errorCode: status >= 400 ? "http_error" : null, reqId: null};
}

async function sessionRequest<T>(args: {
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  sessionId?: string;
  orgId?: string;
}): Promise<GatewayResult<T>> {
  const headers: Record<string, string> = {"Content-Type": "application/json"};
  if (args.sessionId) headers.Authorization = args.sessionId; // verbatim — no `Bearer`
  if (args.orgId) headers.Organization = args.orgId;

  let response: Response;
  try {
    response = await fetch(`${CUSTRAL_API_URL}/v1/${args.path.replace(/^\/+/, "")}`, {
      method: args.method,
      headers,
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
      cache: "no-store",
    });
  } catch {
    return {ok: false, data: null, errorCode: "network_error", reqId: null};
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return unwrap<T>(response.status, json);
}

// ── Device login (RFC 8628) ──────────────────────────────────────────────────

export interface DeviceCodeStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

export async function startDeviceLogin(clientName: string): Promise<GatewayResult<DeviceCodeStart>> {
  return sessionRequest<DeviceCodeStart>({method: "POST", path: "auth/device/code", body: {clientName}});
}

export interface DeviceTokenResult {
  ok?: boolean;
  sessionId?: string;
  accountId?: string;
  orgId?: string | null;
  error?: string;
}

/**
 * Polls once. The caller owns the loop so it can honour `interval` and the
 * `slow_down` backoff — the same shape `packages/cli/src/commands/login.ts` uses.
 */
export async function pollDeviceToken(deviceCode: string): Promise<GatewayResult<DeviceTokenResult>> {
  return sessionRequest<DeviceTokenResult>({method: "POST", path: "auth/device/token", body: {deviceCode}});
}

// ── Bootstrap (session-authed) ───────────────────────────────────────────────

export interface GatewayOrganization {
  id: string;
  name: string;
  slug?: string;
}

export async function listOrganizations(sessionId: string): Promise<GatewayResult<GatewayOrganization[]>> {
  return sessionRequest<GatewayOrganization[]>({method: "GET", path: "organizations", sessionId});
}

export interface GatewayApplication {
  id: string;
  name: string;
}

export async function createApplication(args: {
  sessionId: string;
  orgId: string;
  name: string;
}): Promise<GatewayResult<GatewayApplication>> {
  return sessionRequest<GatewayApplication>({
    method: "POST",
    path: "applications",
    body: {name: args.name},
    sessionId: args.sessionId,
    orgId: args.orgId,
  });
}

export interface GatewayApplicationKey {
  id: string;
  key?: string;
  keyPreview?: string;
  type?: string;
  scopes?: string[];
}

/** Lists an application's keys. The plaintext is NOT returned — only a preview. */
export async function listApplicationKeys(args: {
  sessionId: string;
  orgId: string;
  applicationId: string;
}): Promise<GatewayResult<GatewayApplicationKey[]>> {
  return sessionRequest<GatewayApplicationKey[]>({
    method: "GET",
    path: `applications/${encodeURIComponent(args.applicationId)}/keys`,
    sessionId: args.sessionId,
    orgId: args.orgId,
  });
}

/** Mints a key. This is the ONLY time the plaintext is ever returned. */
export async function createApplicationKey(args: {
  sessionId: string;
  orgId: string;
  applicationId: string;
  type: "publishable" | "secret";
  name: string;
  scopes?: string[];
}): Promise<GatewayResult<GatewayApplicationKey>> {
  return sessionRequest<GatewayApplicationKey>({
    method: "POST",
    path: `applications/${encodeURIComponent(args.applicationId)}/keys`,
    body: {type: args.type, name: args.name, scopes: args.scopes},
    sessionId: args.sessionId,
    orgId: args.orgId,
  });
}

/**
 * Deactivates one of an application's keys.
 *
 * An API key does not expire, so forgetting one locally leaves a live
 * credential in the customer's workspace that nothing here can ever reach
 * again. Disconnecting revokes the keys it minted as well as the session.
 */
export async function deactivateApplicationKey(args: {
  sessionId: string;
  orgId: string;
  applicationId: string;
  keyId: string;
}): Promise<GatewayResult<unknown>> {
  return sessionRequest<unknown>({
    method: "DELETE",
    path: `applications/${encodeURIComponent(args.applicationId)}/keys/${encodeURIComponent(args.keyId)}`,
    sessionId: args.sessionId,
    orgId: args.orgId,
  });
}

/**
 * Revokes the device-login session.
 *
 * Piper stores a real Custral session, so disconnecting has to hand it back
 * rather than merely forgetting it locally.
 */
export async function logoutSession(sessionId: string): Promise<GatewayResult<unknown>> {
  return sessionRequest<unknown>({method: "POST", path: "auth/logout", sessionId});
}
