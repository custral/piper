"use client";

import {useCallback, useState} from "react";
import {useRouter} from "next/navigation";

import {Button} from "@/components/ui/button";

/**
 * Hands the Custral session back and forgets the connection.
 *
 * Worth having rather than telling people to delete a file: the demo stores a
 * real session, so there should be an obvious way to revoke it.
 */
export function DisconnectButton(): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/connect/disconnect", {method: "POST"});
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [router]);

  return (
    <Button variant="outline" onClick={handleDisconnect} disabled={busy}>
      {busy ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}
