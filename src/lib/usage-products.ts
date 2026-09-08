/**
 * Maps each demo feature to a Custral `productRecordId`.
 *
 * IDs come from the operator's pre-seeded Custral workspace and are read from
 * environment variables on every call (not at module load) so tests and dev
 * servers can change configuration without a restart.
 */
export const USAGE_PRODUCT_KEYS = ["compress"] as const;
export type UsageProductKey = (typeof USAGE_PRODUCT_KEYS)[number];

interface UsageProductDefinition {
  label: string;
  productRecordId: string;
}

const PRODUCT_LABELS: Record<UsageProductKey, string> = {
  compress: "Middle-Out Compression",
};

const PRODUCT_ENV_KEYS: Record<UsageProductKey, string> = {
  compress: "CUSTRAL_PRODUCT_COMPRESS_ID",
};

export function getUsageProduct(key: UsageProductKey): UsageProductDefinition {
  return {
    label: PRODUCT_LABELS[key],
    productRecordId: process.env[PRODUCT_ENV_KEYS[key]] ?? "",
  };
}
