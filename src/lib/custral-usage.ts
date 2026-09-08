import {CustralUsage} from "@custral/js";

import {getUsageProduct, type UsageProductKey} from "@/lib/usage-products";
import {readConnection} from "@/lib/store";
import type {Account} from "@/types";

/**
 * Usage metering for the demo.
 *
 * Configuration comes from the **connected workspace** when there is one — the
 * Connect flow provisions the key, the module and the product record, so
 * nothing has to be pasted into a file. The environment variables remain as a
 * fallback for anyone who would rather wire it up by hand.
 *
 * Nothing here throws: a demo that cannot meter should still compress.
 */

export interface ResolvedUsageConfig {
  key: string;
  moduleId: string;
  productRecordId: string;
  baseUrl?: string;
}

/**
 * The connection first, then the environment.
 *
 * Returns `undefined` rather than a half-filled config — a `CustralUsage` built
 * without a module id throws on construction, and a track with no product
 * record is refused by the API anyway.
 *
 * ⚠ The connected branch ignores `product`, because the Connect flow provisions
 * exactly one product record and `USAGE_PRODUCT_KEYS` holds exactly one key.
 * **Adding a second key means giving the connection a record per product** —
 * without that, the new feature would silently meter against Compress, which is
 * a wrong number in the customer's billing rather than a missing one. The
 * `compressProductRecordId` field is named for that one product so the coupling
 * is visible from the store.
 */
export async function resolveUsageConfig(product: UsageProductKey): Promise<ResolvedUsageConfig | undefined> {
  const connection = await readConnection();
  if (connection) {
    return {
      key: connection.publishableKey,
      moduleId: connection.usageModuleId,
      productRecordId: connection.compressProductRecordId,
      baseUrl: process.env.CUSTRAL_API_BASE_URL,
    };
  }

  const key = process.env.CUSTRAL_PUBLISHABLE_KEY;
  const moduleId = process.env.CUSTRAL_MODULE_ID;
  const productRecordId = getUsageProduct(product).productRecordId;
  if (!key || !moduleId || !productRecordId) return undefined;
  return {key, moduleId, productRecordId, baseUrl: process.env.CUSTRAL_API_BASE_URL};
}

export interface TrackUsageInput {
  product: UsageProductKey;
  account: Pick<Account, "customerRecordId">;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort usage tracker. Logs and returns rather than throwing, so a
 * misconfigured (or unconnected) demo still compresses files.
 */
export async function trackUsage({product, account, quantity, metadata}: TrackUsageInput): Promise<void> {
  const config = await resolveUsageConfig(product);
  if (!config) {
    console.warn("[piper] Custral is not connected — skipping usage tracking for", product);
    return;
  }

  try {
    // Built per call rather than cached: reconnecting to a different workspace
    // changes the key and the module, and a cached client would keep metering
    // against the old one.
    const client = new CustralUsage({key: config.key, moduleId: config.moduleId, baseUrl: config.baseUrl});
    await client.track({
      productRecordId: config.productRecordId,
      customerRecordId: account.customerRecordId,
      quantity,
      metadata,
    });
  } catch (err) {
    console.error(`[piper] CustralUsage.track failed for "${product}":`, err);
  }
}
