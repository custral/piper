import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {existsSync} from "node:fs";
import {rm, mkdtemp} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";

import {
  _resetStoreForTests,
  appendCompression,
  createAccount,
  getAccount,
  getAccountState,
  listAccounts,
  mergePending,
  readConnection,
  readPending,
  setStorePath,
  writeConnection,
} from "./store";
import type {CustralConnection} from "@/types";

const CONNECTION: CustralConnection = {
  sessionId: "sess_1",
  orgId: "org_1",
  orgName: "Acme",
  applicationId: "app_1",
  publishableKey: "pk_1",
  secretKey: "sk_1",
  customerObjectId: "obj_customers",
  productObjectId: "obj_products",
  usageModuleId: "umod_1",
  compressProductRecordId: "rec_product",
  connectedAt: "2026-01-02T03:04:05.000Z",
};

const COMPRESSION = {
  id: "c1",
  fileName: "test.bin",
  originalBytes: 1024,
  compressedBytes: 256,
  weissmanScore: 4.2,
  createdAt: "2026-01-02T03:04:05.000Z",
};

let testDir: string;
let testStorePath: string;

beforeEach(async () => {
  testDir = await mkdtemp(path.join(tmpdir(), "piper-store-test-"));
  testStorePath = path.join(testDir, "store.json");
  setStorePath(testStorePath);
});

afterEach(async () => {
  // Surgical: only the per-test temp directory we created. Never bulk-wipe.
  if (existsSync(testDir)) await rm(testDir, {recursive: true, force: true});
  _resetStoreForTests();
});

describe("store", () => {
  it("seeds three demo accounts on first read", async () => {
    const accounts = await listAccounts();
    expect(accounts).toHaveLength(3);
    const names = accounts.map((a) => a.name);
    expect(names).toEqual(expect.arrayContaining(["Richard Hendricks", "Bertram Gilfoyle", "Dinesh Chugtai"]));
  });

  it("creates a new account and persists it", async () => {
    const created = await createAccount({
      name: "Jared Dunn",
      email: "jared@piedpiper.com",
      customerRecordId: "rec_demo_jared",
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Jared Dunn");
    expect(created.avatarColor).toMatch(/^bg-/);

    const fetched = await getAccount(created.id);
    expect(fetched?.email).toBe("jared@piedpiper.com");

    const all = await listAccounts();
    expect(all).toHaveLength(4);
  });

  it("appends compression records scoped to a single account", async () => {
    const a = await createAccount({name: "A", email: "a@p.com", customerRecordId: "rec_a"});
    await appendCompression(a.id, {
      id: "c1",
      fileName: "test.bin",
      originalBytes: 1024,
      compressedBytes: 256,
      weissmanScore: 4.2,
      createdAt: new Date().toISOString(),
    });

    const state = await getAccountState(a.id);
    expect(state?.compressions).toHaveLength(1);
    expect(state?.compressions[0]?.fileName).toBe("test.bin");
  });
});

/**
 * A mutator that returns only the slice it changed deletes every other
 * top-level key. Both of these did, so compressing a file — the demo's whole
 * point — silently disconnected the workspace it was metering against, and the
 * next request fell back to unset env vars and stopped tracking.
 */
describe("store: a mutation keeps the keys it did not touch", () => {
  it("keeps the connection across appendCompression", async () => {
    await writeConnection(CONNECTION);
    const a = await createAccount({name: "A", email: "a@p.com", customerRecordId: "rec_a"});
    await appendCompression(a.id, COMPRESSION);
    expect(await readConnection()).toMatchObject({usageModuleId: "umod_1"});
  });

  it("keeps the connection across createAccount", async () => {
    await writeConnection(CONNECTION);
    await createAccount({name: "Jian Yang", email: "jian@p.com", customerRecordId: "rec_j"});
    expect(await readConnection()).toMatchObject({usageModuleId: "umod_1"});
  });

  // The chain has to wrap the READ as well as the write, or two callers start
  // from the same state and the later write discards the earlier one.
  it("does not lose a concurrent write to another key", async () => {
    await Promise.all([
      mergePending({deviceCode: "dev_1"}),
      createAccount({name: "Erlich", email: "erlich@p.com", customerRecordId: "rec_e"}),
    ]);
    expect(await readPending()).toMatchObject({deviceCode: "dev_1"});
    expect((await listAccounts()).some((account) => account.email === "erlich@p.com")).toBe(true);
  });
});
