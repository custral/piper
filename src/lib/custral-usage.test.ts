import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const {trackMock, constructedWith, readConnectionMock} = vi.hoisted(() => ({
  trackMock: vi.fn(),
  constructedWith: vi.fn(),
  readConnectionMock: vi.fn(),
}));

vi.mock("@custral/js", () => ({
  CustralUsage: class StubCustralUsage {
    track = trackMock;
    constructor(config: unknown) {
      constructedWith(config);
    }
  },
}));

// The store touches disk; the unit under test only needs its answer.
vi.mock("@/lib/store", () => ({readConnection: readConnectionMock}));

import {trackUsage} from "./custral-usage";

beforeEach(() => {
  trackMock.mockReset().mockResolvedValue({success: true, id: "evt_1"});
  constructedWith.mockReset();
  readConnectionMock.mockReset().mockResolvedValue(undefined);
  process.env.CUSTRAL_PUBLISHABLE_KEY = "pk_test";
  process.env.CUSTRAL_MODULE_ID = "umod_test";
  process.env.CUSTRAL_PRODUCT_COMPRESS_ID = "rec_compress";
});

afterEach(() => {
  delete process.env.CUSTRAL_PUBLISHABLE_KEY;
  delete process.env.CUSTRAL_MODULE_ID;
  delete process.env.CUSTRAL_PRODUCT_COMPRESS_ID;
});

describe("trackUsage", () => {
  it("forwards the product + customer ids to the SDK", async () => {
    await trackUsage({
      product: "compress",
      account: {customerRecordId: "rec_demo_richard"},
      quantity: 2048,
      metadata: {fileName: "weissman.bin"},
    });
    expect(trackMock).toHaveBeenCalledWith({
      productRecordId: "rec_compress",
      customerRecordId: "rec_demo_richard",
      quantity: 2048,
      metadata: {fileName: "weissman.bin"},
    });
  });

  it("prefers the connected workspace over the environment", async () => {
    readConnectionMock.mockResolvedValue({
      publishableKey: "pk_connected",
      usageModuleId: "umod_connected",
      compressProductRecordId: "rec_connected",
    });
    await trackUsage({product: "compress", account: {customerRecordId: "rec_x"}, quantity: 1});
    expect(constructedWith).toHaveBeenCalledWith(
      expect.objectContaining({key: "pk_connected", moduleId: "umod_connected"}),
    );
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({productRecordId: "rec_connected"}));
  });

  it("swallows SDK errors so the demo keeps working", async () => {
    trackMock.mockRejectedValueOnce(new Error("network down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      trackUsage({product: "compress", account: {customerRecordId: "rec_x"}, quantity: 1}),
    ).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });

  it("no-ops when neither a connection nor env vars are present", async () => {
    delete process.env.CUSTRAL_PUBLISHABLE_KEY;
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await trackUsage({product: "compress", account: {customerRecordId: "rec_x"}, quantity: 1});
    expect(trackMock).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("no-ops when the product record id is missing, rather than tracking against nothing", async () => {
    delete process.env.CUSTRAL_PRODUCT_COMPRESS_ID;
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await trackUsage({product: "compress", account: {customerRecordId: "rec_x"}, quantity: 1});
    expect(trackMock).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
