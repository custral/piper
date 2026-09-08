"use client";

import {Avatar, AvatarFallback} from "@/components/ui/avatar";
import {cn} from "@/lib/utils";
import type {Account} from "@/types";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface AccountCardProps {
  account: Account;
  onSelect: (id: string) => void;
}

export function AccountCard({account, onSelect}: AccountCardProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onSelect(account.id)}
      className="group flex flex-col items-center gap-3 rounded-xl border bg-card p-6 transition-all hover:border-primary hover:shadow-lg"
    >
      <Avatar className={cn("h-20 w-20 ring-2 ring-transparent group-hover:ring-primary/40", account.avatarColor)}>
        <AvatarFallback className={cn("text-xl font-semibold text-white", account.avatarColor)}>
          {initials(account.name)}
        </AvatarFallback>
      </Avatar>
      <div className="text-center">
        <div className="text-base font-semibold">{account.name}</div>
        <div className="text-xs text-muted-foreground">{account.email}</div>
      </div>
    </button>
  );
}
