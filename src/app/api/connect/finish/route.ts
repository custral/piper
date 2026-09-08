import {NextResponse} from "next/server";

import {createWorkspaceUsageModule, ensureProductRecord, listCustomerRecords} from "@/lib/custral-workspace";
import {clearPending, mergePending, readPending, replaceAccounts, writeConnection} from "@/lib/store";
import type {Account, CustralConnection} from "@/types";

const COMPRESS_PRODUCT_NAME = "Middle-Out Compression";

const AVATAR_PALETTE = ["bg-emerald-500", "bg-violet-500", "bg-sky-500", "bg-amber-500", "bg-pink-500", "bg-cyan-500"];

/**
 * Step 4 — the visitor picked the two objects. Provision and commit.
 *
 * Creates the usage module, finds or creates the Compress product record, and
 * replaces the three placeholder accounts with **real** records from the
 * workspace. That last part is what makes the demo live: the seeded
 * `rec_demo_*` ids exist nowhere, so metering against them is refused.
 *
 * Each creation is recorded on the pending blob AS IT LANDS. This step writes
 * to somebody's real workspace and its failure leaves them looking at the same
 * button, so a retry has to resume rather than start over — otherwise a flaky
 * record lookup costs the workspace a second "Pied Piper usage" module every
 * time it is pressed.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const pending = await readPending();
  if (!pending?.sessionId || !pending.secretKey || !pending.publishableKey || !pending.orgId) {
    return NextResponse.json({error: "Connection is incomplete. Start again."}, {status: 409});
  }

  const body = (await request.json()) as {customerObjectId?: string; productObjectId?: string};
  const customerObjectId = body.customerObjectId?.trim();
  const productObjectId = body.productObjectId?.trim();
  if (!customerObjectId || !productObjectId) {
    return NextResponse.json({error: "Pick both a customer object and a product object."}, {status: 400});
  }

  let usageModuleId: string;
  let compressProductRecordId: string;
  let customers: Awaited<ReturnType<typeof listCustomerRecords>>;
  try {
    // Reuse only what a previous attempt built for THESE objects — changing a
    // picker before retrying is a request for a different module.
    const reusableModuleId =
      pending.usageModuleCustomerObjectId === customerObjectId && pending.usageModuleProductObjectId === productObjectId
        ? pending.usageModuleId
        : undefined;
    if (reusableModuleId) {
      usageModuleId = reusableModuleId;
    } else {
      usageModuleId = await createWorkspaceUsageModule({
        secretKey: pending.secretKey,
        name: "Pied Piper usage",
        productObjectId,
        customerObjectId,
      });
      await mergePending({
        usageModuleId,
        usageModuleCustomerObjectId: customerObjectId,
        usageModuleProductObjectId: productObjectId,
      });
    }

    const reusableProductRecordId =
      pending.compressProductObjectId === productObjectId ? pending.compressProductRecordId : undefined;
    if (reusableProductRecordId) {
      compressProductRecordId = reusableProductRecordId;
    } else {
      compressProductRecordId = await ensureProductRecord({
        secretKey: pending.secretKey,
        objectId: productObjectId,
        name: COMPRESS_PRODUCT_NAME,
      });
      await mergePending({compressProductRecordId, compressProductObjectId: productObjectId});
    }

    customers = await listCustomerRecords({secretKey: pending.secretKey, objectId: customerObjectId});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not finish setting up the workspace.";
    return NextResponse.json({error: message}, {status: 502});
  }

  const connection: CustralConnection = {
    sessionId: pending.sessionId,
    orgId: pending.orgId,
    orgName: pending.orgName ?? pending.orgId,
    applicationId: pending.applicationId ?? "",
    publishableKey: pending.publishableKey,
    secretKey: pending.secretKey,
    customerObjectId,
    productObjectId,
    usageModuleId,
    compressProductRecordId,
    connectedAt: new Date().toISOString(),
  };

  await writeConnection(connection);

  // Only swap the accounts when there are real ones to swap in — a workspace
  // with an empty customer object should keep the seeds rather than show an
  // empty picker with no way back.
  if (customers.length > 0) {
    const accounts: Account[] = customers.map((customer, index) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      avatarColor: AVATAR_PALETTE[index % AVATAR_PALETTE.length]!,
      customerRecordId: customer.id,
      createdAt: new Date().toISOString(),
    }));
    await replaceAccounts(accounts);
  }

  await clearPending();

  return NextResponse.json({
    connected: true,
    orgName: connection.orgName,
    accountsPulled: customers.length,
  });
}
