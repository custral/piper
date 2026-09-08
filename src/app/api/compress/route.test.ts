import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {existsSync} from "node:fs";
import {mkdtemp, rm} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";

const {trackUsageMock} = vi.hoisted(() => ({trackUsageMock: vi.fn()}));

vi.mock("@/lib/custral-usage", () => ({
  trackUsage: trackUsageMock,
}));

vi.mock("@/lib/active-account", () => ({
  getActiveAccount: vi.fn(),
}));

import {_resetStoreForTests, createAccount, getAccountState, setStorePath} from "@/lib/store";
import {getActiveAccount} from "@/lib/active-account";

import {POST} from "./route";

let testDir: string;

beforeEach(async () => {
  trackUsageMock.mockReset().mockResolvedValue(undefined);
  testDir = await mkdtemp(path.join(tmpdir(), "piper-compress-test-"));
  setStorePath(path.join(testDir, "store.json"));
});

afterEach(async () => {
  if (existsSync(testDir)) await rm(testDir, {recursive: true, force: true});
  _resetStoreForTests();
  vi.clearAllMocks();
});

function makeRequest(file: File): Request {
  const fd = new FormData();
  fd.append("file", file);
  return new Request("http://localhost/api/compress", {method: "POST", body: fd});
}

describe("POST /api/compress", () => {
  it("returns 401 when no active account", async () => {
    vi.mocked(getActiveAccount).mockResolvedValue(undefined);
    const res = await POST(makeRequest(new File(["data"], "x.bin")));
    expect(res.status).toBe(401);
  });

  it("appends a compression record and tracks usage with the original byte count", async () => {
    const account = await createAccount({name: "A", email: "a@p.com", customerRecordId: "rec_a"});
    vi.mocked(getActiveAccount).mockResolvedValue(account);

    const fileBytes = new Uint8Array(2048);
    const file = new File([fileBytes], "weissman.bin");
    const res = await POST(makeRequest(file));

    expect(res.status).toBe(200);
    expect(trackUsageMock).toHaveBeenCalledTimes(1);
    expect(trackUsageMock.mock.calls[0]?.[0]).toMatchObject({
      product: "compress",
      account,
      quantity: 2048,
    });

    const state = await getAccountState(account.id);
    expect(state?.compressions).toHaveLength(1);
    expect(state?.compressions[0]?.fileName).toBe("weissman.bin");
    expect(state?.compressions[0]?.originalBytes).toBe(2048);
  });

  it("returns 400 when no file is provided", async () => {
    const account = await createAccount({name: "B", email: "b@p.com", customerRecordId: "rec_b"});
    vi.mocked(getActiveAccount).mockResolvedValue(account);

    const fd = new FormData();
    const res = await POST(new Request("http://localhost/api/compress", {method: "POST", body: fd}));
    expect(res.status).toBe(400);
  });
});
