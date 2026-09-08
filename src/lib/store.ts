import {mkdir, readFile, writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import type {Account, AccountState, CompressionRecord, CustralConnection, PendingConnection, PiperStore} from "@/types";

/**
 * Tiny JSON-on-disk store for the Pied Piper demo.
 *
 * This is intentionally not a real database. The whole store is read into
 * memory, mutated, and written back. Every mutation runs on a single in-process
 * chain — the READ included, so two concurrent callers cannot both start from
 * the same state and have the later write discard the earlier one.
 *
 * Every mutator spreads the store it was handed. A mutator that returns only the
 * slice it changed deletes every other top-level key, which is how a compression
 * came to wipe the Custral connection.
 *
 * Tests can override the store path via {@link setStorePath} to keep the
 * default `.data/store.json` file untouched.
 */

const DEFAULT_STORE_PATH = path.join(process.cwd(), ".data", "store.json");
let storePath = DEFAULT_STORE_PATH;
let writeChain: Promise<unknown> = Promise.resolve();

const SEED_ACCOUNTS: Omit<Account, "createdAt">[] = [
  {
    id: "richard",
    name: "Richard Hendricks",
    email: "richard@piedpiper.com",
    avatarColor: "bg-emerald-500",
    customerRecordId: "rec_demo_richard",
  },
  {
    id: "gilfoyle",
    name: "Bertram Gilfoyle",
    email: "gilfoyle@piedpiper.com",
    avatarColor: "bg-violet-500",
    customerRecordId: "rec_demo_gilfoyle",
  },
  {
    id: "dinesh",
    name: "Dinesh Chugtai",
    email: "dinesh@piedpiper.com",
    avatarColor: "bg-sky-500",
    customerRecordId: "rec_demo_dinesh",
  },
];

/** Tests use this to point at a temp file. Production code should not call it. */
export function setStorePath(nextPath: string): void {
  storePath = nextPath;
}

/** Tests use this to clear in-process state when overriding the path. */
export function _resetStoreForTests(): void {
  storePath = DEFAULT_STORE_PATH;
  writeChain = Promise.resolve();
}

async function ensureStoreFile(): Promise<void> {
  if (existsSync(storePath)) return;
  await mkdir(path.dirname(storePath), {recursive: true});
  const seed: PiperStore = {
    accounts: SEED_ACCOUNTS.map((a) => ({
      account: {...a, createdAt: new Date().toISOString()},
      compressions: [],
    })),
  };
  await writeFile(storePath, JSON.stringify(seed, null, 2), "utf8");
}

export async function readStore(): Promise<PiperStore> {
  await ensureStoreFile();
  const raw = await readFile(storePath, "utf8");
  return JSON.parse(raw) as PiperStore;
}

export async function writeStore(store: PiperStore): Promise<void> {
  await mkdir(path.dirname(storePath), {recursive: true});
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

/**
 * Read, mutate, write — with the WHOLE cycle on the chain, not just the write.
 *
 * Serialising the write alone is not enough and reads as though it were: two
 * concurrent callers both read the same state, then both write, and the second
 * silently discards the first. The demo hits that for real — a compression
 * landing while the Connect wizard is mid-step is two mutators against one file.
 */
async function mutateStore<T>(mutator: (store: PiperStore) => {next: PiperStore; result: T}): Promise<T> {
  const run = writeChain.then(async () => {
    const current = await readStore();
    const {next, result} = mutator(current);
    await writeStore(next);
    return result;
  });
  // The chain must not stay rejected, or one failed write blocks every later one.
  writeChain = run.catch(() => undefined);
  return run;
}

// ── The Custral connection ───────────────────────────────────────────────────

/**
 * The connected workspace, or `undefined` when the demo has not been connected.
 *
 * Server-only. Never hand the whole thing to a client component — it carries a
 * session id and a secret key. `publishableKey` is the one field safe to pass
 * to the browser.
 */
export async function readConnection(): Promise<CustralConnection | undefined> {
  const store = await readStore();
  return store.connection;
}

/** Returns the store without one top-level key. */
function withoutKey(store: PiperStore, key: "connection" | "pendingConnection"): PiperStore {
  const next = {...store};
  delete next[key];
  return next;
}

export async function readPending(): Promise<PendingConnection | undefined> {
  const store = await readStore();
  return store.pendingConnection;
}

/** Merges into the pending blob so each wizard step adds only what it learned. */
export async function mergePending(patch: Partial<PendingConnection>): Promise<PendingConnection> {
  return mutateStore((store) => {
    const pendingConnection: PendingConnection = {
      startedAt: store.pendingConnection?.startedAt ?? new Date().toISOString(),
      ...store.pendingConnection,
      ...patch,
    };
    return {next: {...store, pendingConnection}, result: pendingConnection};
  });
}

export async function clearPending(): Promise<void> {
  await mutateStore((store) => ({next: withoutKey(store, "pendingConnection"), result: undefined}));
}

export async function writeConnection(connection: CustralConnection): Promise<void> {
  // Committing a connection retires the half-finished one it came from.
  await mutateStore((store) => ({next: {...withoutKey(store, "pendingConnection"), connection}, result: undefined}));
}

/**
 * Forgets the connection. Called after the session has been revoked upstream —
 * dropping it locally without revoking would leave a live credential behind.
 */
export async function clearConnection(): Promise<void> {
  await mutateStore((store) => ({next: withoutKey(store, "connection"), result: undefined}));
}

/**
 * Replaces the demo accounts with real records pulled from the workspace.
 *
 * The three seeded accounts carry placeholder record ids (`rec_demo_richard`),
 * which no workspace has — usage tracked against one is refused. Connecting
 * swaps them for records that exist, which is what makes the demo meter
 * anything.
 */
export async function replaceAccounts(accounts: Account[]): Promise<void> {
  await mutateStore((store) => {
    // Keep any compression history for accounts that survive the swap.
    const byRecordId = new Map(store.accounts.map((a) => [a.account.customerRecordId, a]));
    return {
      next: {
        ...store,
        accounts: accounts.map((account) => ({
          account,
          compressions: byRecordId.get(account.customerRecordId)?.compressions ?? [],
        })),
      },
      result: undefined,
    };
  });
}

export async function listAccounts(): Promise<Account[]> {
  const store = await readStore();
  return store.accounts.map((a) => a.account);
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const store = await readStore();
  return store.accounts.find((a) => a.account.id === id)?.account;
}

export async function getAccountState(id: string): Promise<AccountState | undefined> {
  const store = await readStore();
  return store.accounts.find((a) => a.account.id === id);
}

export interface CreateAccountInput {
  name: string;
  email: string;
  customerRecordId: string;
  avatarColor?: string;
}

const AVATAR_PALETTE = [
  "bg-emerald-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-orange-500",
];

function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx] ?? AVATAR_PALETTE[0]!;
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const id = crypto.randomUUID();
  const account: Account = {
    id,
    name: input.name.trim(),
    email: input.email.trim(),
    customerRecordId: input.customerRecordId.trim(),
    avatarColor: input.avatarColor ?? pickAvatarColor(input.email || id),
    createdAt: new Date().toISOString(),
  };
  // Spread the store: returning a bare `{accounts}` silently drops `connection`
  // and `pendingConnection`, which is a disconnect nobody asked for.
  return mutateStore((store) => ({
    next: {...store, accounts: [...store.accounts, {account, compressions: []}]},
    result: account,
  }));
}

export async function appendCompression(accountId: string, record: CompressionRecord): Promise<void> {
  await mutateStore((store) => {
    const accounts = store.accounts.map((a) =>
      a.account.id === accountId ? {...a, compressions: [...a.compressions, record]} : a,
    );
    // Spread the store — see `createAccount`. Compressing a file must not
    // disconnect the workspace it is being metered against.
    return {next: {...store, accounts}, result: undefined};
  });
}
