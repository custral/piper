"use client";

import {useTransition} from "react";

import {AccountCard} from "@/components/account-card";
import {NewAccountDialog} from "@/components/new-account-dialog";
import {setActiveAccountAction} from "@/lib/account-actions";
import type {Account} from "@/types";

interface AccountPickerProps {
  accounts: Account[];
}

export function AccountPicker({accounts}: AccountPickerProps): React.ReactElement {
  const [, startTransition] = useTransition();

  function handleSelect(id: string): void {
    startTransition(() => {
      setActiveAccountAction(id);
    });
  }

  return (
    <div className="grid w-full max-w-4xl grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} onSelect={handleSelect} />
      ))}
      <NewAccountDialog />
    </div>
  );
}
