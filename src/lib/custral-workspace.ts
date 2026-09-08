import "server-only";

import {Custral} from "@custral/sdk";

import {CUSTRAL_API_URL} from "@/lib/custral-gateway";
import type {CustralConnection} from "@/types";

/**
 * Reads and writes the connected workspace through `@custral/sdk` — the same
 * package a customer would use, which is half the point of this demo.
 *
 * Everything here needs the **secret** key, so it is server-only. The browser
 * gets the `pk_` and nothing else.
 */

export function sdkFor(connection: Pick<CustralConnection, "secretKey">): Custral {
  return new Custral({apiKey: connection.secretKey, baseUrl: CUSTRAL_API_URL});
}

export interface WorkspaceObject {
  id: string;
  key?: string | null;
  name?: string | null;
}

/** The workspace's objects, for the "which one holds your customers?" pickers. */
export async function listWorkspaceObjects(secretKey: string): Promise<WorkspaceObject[]> {
  const custral = new Custral({apiKey: secretKey, baseUrl: CUSTRAL_API_URL});
  const objects = await custral.objects.list();
  return objects.map((o) => ({id: o.id, key: o.key ?? null, name: (o.name as string) ?? null}));
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  email: string;
}

/**
 * Pulls real records to stand in as the demo's accounts.
 *
 * This is what makes the demo *live*: piper ships with three placeholder
 * accounts whose `rec_demo_*` ids exist in no workspace, so metering against
 * them is refused. After connecting, the account picker lists people who
 * actually exist and Compress meters against them.
 *
 * A record with no readable name is skipped rather than shown as its id.
 */
export async function listCustomerRecords(args: {
  secretKey: string;
  objectId: string;
  limit?: number;
}): Promise<WorkspaceRecord[]> {
  const custral = new Custral({apiKey: args.secretKey, baseUrl: CUSTRAL_API_URL});
  const page = await custral.records.list({object: args.objectId, limit: args.limit ?? 12});

  return page.data
    .map((record) => {
      const fields = (record.fields ?? {}) as Record<string, unknown>;
      const pick = (...keys: string[]): string => {
        for (const key of keys) {
          const value = fields[key];
          if (typeof value === "string" && value.trim()) return value.trim();
        }
        return "";
      };
      const name = (typeof record.name === "string" && record.name.trim()) || pick("name", "full_name", "first_name");
      const email = pick("email", "email_address", "work_email");
      return {id: record.id, name, email};
    })
    .filter((record) => record.name.length > 0);
}

/** A record's display name, lowercased for comparison. */
function recordName(record: {name?: unknown; fields?: unknown}): string {
  const fields = (record.fields ?? {}) as Record<string, unknown>;
  const name = (typeof record.name === "string" && record.name) || (fields.name as string) || "";
  return name.trim().toLowerCase();
}

/**
 * Finds or creates the record standing in for the Compress product.
 *
 * Reuses a matching record rather than adding a duplicate every time somebody
 * reconnects — a demo that litters a real workspace is a demo people stop
 * pointing at real workspaces.
 */
export async function ensureProductRecord(args: {secretKey: string; objectId: string; name: string}): Promise<string> {
  const custral = new Custral({apiKey: args.secretKey, baseUrl: CUSTRAL_API_URL});
  const wanted = args.name.trim().toLowerCase();

  // Ask the SERVER for the match rather than paging for it. A customer's product
  // object can hold thousands of records, so scanning one page and creating on a
  // miss would add a second "Middle-Out Compression" to their real workspace
  // every time Connect ran against a large object. The filter is an exact match,
  // so the case-insensitive comparison still runs over what comes back.
  //
  // An object whose title property is not keyed `name` may refuse the filter —
  // that falls through to the create, which is what an unmatched scan did anyway.
  try {
    const found = await custral.records.list({object: args.objectId, filter: {name: args.name}, limit: 10});
    const match = found.data.find((record) => recordName(record) === wanted);
    if (match) return match.id;
  } catch {
    // The filter is an optimisation, not the contract — fall through.
  }

  const created = await custral.records.create({object: args.objectId, name: args.name, fields: {name: args.name}});
  return created.id;
}

/** Creates the usage module that Compress meters against. */
export async function createWorkspaceUsageModule(args: {
  secretKey: string;
  name: string;
  productObjectId: string;
  customerObjectId: string;
}): Promise<string> {
  const custral = new Custral({apiKey: args.secretKey, baseUrl: CUSTRAL_API_URL});
  const module = await custral.usageModules.create({
    name: args.name,
    productObjectId: args.productObjectId,
    customerObjectId: args.customerObjectId,
  });
  return module.id;
}

export interface WorkspaceUsageEvent {
  id: string;
  quantity: number;
  occurredAt: string;
  customerRecordId: string;
}

/** How many events the usage page shows. The endpoint pages, so this is stated. */
export const USAGE_EVENT_PAGE_SIZE = 50;

/**
 * The events Compress has recorded — what makes the usage page show real data.
 *
 * The newest page, not the history: `listEvents` pages, and a workspace meters
 * once per compression, so there is no bound on how many there could be.
 */
export async function listWorkspaceUsageEvents(args: {
  secretKey: string;
  moduleId: string;
  customerRecordId?: string;
}): Promise<WorkspaceUsageEvent[]> {
  const custral = new Custral({apiKey: args.secretKey, baseUrl: CUSTRAL_API_URL});
  const events = await custral.usageModules.listEvents(args.moduleId, {
    customerRecordId: args.customerRecordId,
    limit: USAGE_EVENT_PAGE_SIZE,
  });
  return events.map((event) => ({
    id: event.id,
    quantity: typeof event.quantity === "number" ? event.quantity : 0,
    occurredAt: event.occurredAt ?? "",
    customerRecordId: event.customerRecordId ?? "",
  }));
}
