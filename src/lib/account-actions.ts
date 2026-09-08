"use server";

import {redirect} from "next/navigation";

import {clearActiveAccountCookie, setActiveAccountCookie} from "@/lib/active-account";
import {createAccount} from "@/lib/store";

export async function setActiveAccountAction(accountId: string): Promise<void> {
  await setActiveAccountCookie(accountId);
  redirect("/app/compress");
}

export async function clearActiveAccountAction(): Promise<void> {
  await clearActiveAccountCookie();
  redirect("/");
}

export async function createAccountAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const customerRecordId = String(formData.get("customerRecordId") ?? "").trim();

  if (!name || !email || !customerRecordId) {
    throw new Error("All fields are required.");
  }

  const account = await createAccount({name, email, customerRecordId});
  await setActiveAccountCookie(account.id);
  redirect("/app/compress");
}
