export interface Account {
  /** Internal app id (random string). Used for routing/cookies. */
  id: string;
  /** Display name (e.g. "Richard Hendricks"). */
  name: string;
  /** Email shown on the account card. */
  email: string;
  /** Tailwind background color class for the avatar fallback. */
  avatarColor: string;
  /** The Custral record id this Pied Piper user maps to (`rec_...`). */
  customerRecordId: string;
  /** ISO timestamp when the account was created in the local store. */
  createdAt: string;
}

export interface CompressionRecord {
  id: string;
  fileName: string;
  /** Original size in bytes. */
  originalBytes: number;
  /** Compressed size in bytes (computed from ratio). */
  compressedBytes: number;
  /** Weissman score for the compression run. */
  weissmanScore: number;
  createdAt: string;
}

export interface AccountState {
  account: Account;
  compressions: CompressionRecord[];
}

export interface PiperStore {
  accounts: AccountState[];
  /** Set once the demo has been connected to a real Custral workspace. */
  connection?: CustralConnection;
  /** Half-finished connect flow. Cleared once `connection` is committed. */
  pendingConnection?: PendingConnection;
}

/**
 * The connect wizard's working state.
 *
 * Kept server-side between steps rather than in the browser, because it holds a
 * session id from the moment device login completes. Committed to
 * {@link CustralConnection} only when every field is present — a half-connected
 * demo should look unconnected, not broken.
 */
export interface PendingConnection {
  deviceCode?: string;
  sessionId?: string;
  orgId?: string;
  orgName?: string;
  applicationId?: string;
  publishableKey?: string;
  secretKey?: string;
  /**
   * What the last attempt at the final step already created, and the objects it
   * was created FOR. The step writes to a real workspace, and its failure leaves
   * the visitor on a button they will press again — so each piece is recorded as
   * it lands and reused on the retry, or a second attempt mints a second usage
   * module.
   *
   * The object ids are what make the reuse safe: a visitor who changes a picker
   * before retrying is asking for a different module, so the stored one is
   * abandoned rather than silently connected to.
   */
  usageModuleId?: string;
  usageModuleCustomerObjectId?: string;
  usageModuleProductObjectId?: string;
  compressProductRecordId?: string;
  compressProductObjectId?: string;
  startedAt: string;
}

/**
 * Everything the demo learned by connecting to a Custral workspace.
 *
 * Lives server-side in `.data/store.json` (gitignored) and is **never sent to
 * the browser whole** — `sessionId` and `secretKey` are credentials. Only
 * `publishableKey` crosses to the client, which is what a `pk_` is for.
 */
export interface CustralConnection {
  /** The device-login session. Treated as a credential; used only to bootstrap. */
  sessionId: string;
  orgId: string;
  orgName: string;
  applicationId: string;
  /** `pk_…` — safe in the browser. Drives the chat widget and usage tracking. */
  publishableKey: string;
  /** `sk_…` — server-only. Reads objects, records and usage events. */
  secretKey: string;
  /** The object holding this workspace's customers. */
  customerObjectId: string;
  /** The object holding its products. */
  productObjectId: string;
  usageModuleId: string;
  /** The record standing in for Middle-Out Compression. */
  compressProductRecordId: string;
  connectedAt: string;
}
