import {NextResponse} from "next/server";
import crypto from "node:crypto";

import {getActiveAccount} from "@/lib/active-account";
import {simulateCompression} from "@/lib/compression";
import {trackUsage} from "@/lib/custral-usage";
import {appendCompression} from "@/lib/store";
import type {CompressionRecord} from "@/types";

export async function POST(request: Request): Promise<NextResponse> {
  const account = await getActiveAccount();
  if (!account) {
    return NextResponse.json({error: "No active account."}, {status: 401});
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({error: "Expected a `file` form field."}, {status: 400});
  }

  const result = simulateCompression(file.size, file.name || "upload.bin");

  const record: CompressionRecord = {
    id: crypto.randomUUID(),
    fileName: file.name || "upload.bin",
    originalBytes: result.originalBytes,
    compressedBytes: result.compressedBytes,
    weissmanScore: result.weissmanScore,
    createdAt: new Date().toISOString(),
  };

  await appendCompression(account.id, record);

  await trackUsage({
    product: "compress",
    account,
    quantity: result.originalBytes,
    metadata: {fileName: record.fileName, ratio: result.ratio, weissmanScore: result.weissmanScore},
  });

  return NextResponse.json({record, ratio: result.ratio});
}
