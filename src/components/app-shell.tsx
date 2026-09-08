"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {BarChart3, FileArchive, LogOut, MessageSquare} from "lucide-react";
import {useTransition} from "react";

import {PiedPiperLogo} from "@/components/pied-piper-logo";
import {Avatar, AvatarFallback} from "@/components/ui/avatar";
import {Separator} from "@/components/ui/separator";
import {clearActiveAccountAction} from "@/lib/account-actions";
import {cn} from "@/lib/utils";
import type {Account} from "@/types";

interface AppShellProps {
  account: Account;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  {href: "/app/compress", label: "Compress", icon: FileArchive},
  {href: "/app/chat", label: "Chat", icon: MessageSquare},
  {href: "/app/usage", label: "Usage", icon: BarChart3},
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({account, children}: AppShellProps): React.ReactElement {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function handleSwitchAccount(): void {
    startTransition(() => {
      clearActiveAccountAction();
    });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="flex items-center gap-3 px-6 py-5">
          <PiedPiperLogo size={32} />
          <div className="text-lg font-bold tracking-tight">Pied Piper</div>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Separator />
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <Avatar className={cn("h-8 w-8", account.avatarColor)}>
              <AvatarFallback className={cn("text-xs font-semibold text-white", account.avatarColor)}>
                {initials(account.name)}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <div className="truncate text-sm font-semibold">{account.name}</div>
              <div className="truncate text-xs text-muted-foreground">{account.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSwitchAccount}
            disabled={pending}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Switch account"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
