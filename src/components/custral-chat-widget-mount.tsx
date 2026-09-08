"use client";

import {CustralChatWidget} from "@custral/widget";

interface CustralChatWidgetMountProps {
  /**
   * The `pk_…` to authenticate with — resolved on the SERVER (from the connected
   * workspace, falling back to the environment) and passed down.
   *
   * A publishable key is safe in the browser by design; the connection's secret
   * key and session never leave the server.
   */
  publishableKey?: string;
  /** Pin a widget channel. Defaults to the workspace's first. */
  channelId?: string;
  baseUrl?: string;
  /** Signed-in demo account name — pre-identifies the visitor (skips intake). */
  name: string;
  /** Signed-in demo account email — used for booking confirmations. */
  email: string;
}

/**
 * Mounts the live Custral website-chat widget as a floating bubble for the
 * signed-in demo account. Conversations flow into the connected workspace and
 * replies stream back in real time.
 *
 * Renders nothing without a key, so the demo still boots unconnected.
 */
export function CustralChatWidgetMount({
  publishableKey,
  channelId,
  baseUrl,
  name,
  email,
}: CustralChatWidgetMountProps): React.ReactElement | null {
  if (!publishableKey) return null;

  return (
    <CustralChatWidget
      publishableKey={publishableKey}
      channelId={channelId}
      baseUrl={baseUrl}
      visitor={{name, email}}
    />
  );
}
