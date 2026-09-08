"use client";

import {useState, useTransition} from "react";
import {Plus} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {createAccountAction} from "@/lib/account-actions";

export function NewAccountDialog(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData): void {
    setError(undefined);
    startTransition(async () => {
      try {
        await createAccountAction(formData);
      } catch (err) {
        if (err instanceof Error && err.message !== "NEXT_REDIRECT") {
          setError(err.message);
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card/50 p-6 text-muted-foreground transition-all hover:border-primary hover:text-primary"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Plus className="h-8 w-8" />
          </div>
          <div className="text-center">
            <div className="text-base font-semibold">New Account</div>
            <div className="text-xs">Add a Pied Piper teammate</div>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Pied Piper account</DialogTitle>
          <DialogDescription>
            The Custral customer record id maps this in-app user to a record in your Custral workspace. Pre-create the
            record there, then paste its id below.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" name="name" placeholder="Jared Dunn" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="jared@piedpiper.com" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customerRecordId">Custral customer record id</Label>
            <Input id="customerRecordId" name="customerRecordId" placeholder="rec_…" required />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
