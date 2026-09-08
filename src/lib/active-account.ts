import {cookies} from "next/headers";

import {ACTIVE_ACCOUNT_COOKIE} from "@/lib/cookie-names";
import {getAccount} from "@/lib/store";
import type {Account} from "@/types";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export {ACTIVE_ACCOUNT_COOKIE};

/** Reads the active account from the cookie. Returns undefined when missing or stale. */
export async function getActiveAccount(): Promise<Account | undefined> {
  const cookieStore = await cookies();
  const id = cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value;
  if (!id) return undefined;
  return getAccount(id);
}

export async function setActiveAccountCookie(accountId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });
}

export async function clearActiveAccountCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ACCOUNT_COOKIE);
}
