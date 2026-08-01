import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { UserRole } from "@/types/common";

import { useApproveEmail, useBulkApproveEmails } from "../hooks";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ApproveEmailDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState<UserRole>("judge");
  const [bulkText, setBulkText] = useState("");

  const approve = useApproveEmail();
  const bulkApprove = useBulkApproveEmails();

  const reset = () => {
    setEmail("");
    setFullName("");
    setNote("");
    setRole("judge");
    setBulkText("");
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const parsedBulk = bulkText
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const validBulk = parsedBulk.filter((entry) => EMAIL_PATTERN.test(entry));
  const invalidBulk = parsedBulk.filter((entry) => !EMAIL_PATTERN.test(entry));

  const singleValid = EMAIL_PATTERN.test(email.trim());

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve email access</DialogTitle>
          <DialogDescription>
            Only approved addresses can request a sign-in passcode. An account is created automatically the first time
            someone signs in.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="single">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single</TabsTrigger>
            <TabsTrigger value="bulk">Bulk</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="approve-email">Email address</Label>
              <Input
                id="approve-email"
                type="email"
                placeholder="judge@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {email.trim() && !singleValid && <p className="text-xs text-destructive">Enter a valid email address</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="approve-name">Full name (optional)</Label>
                <Input id="approve-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="judge">Judge</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approve-note">Note (optional)</Label>
              <Input id="approve-note" placeholder="e.g. Industry judge, Day 2" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                disabled={!singleValid || approve.isPending}
                onClick={() =>
                  approve.mutate(
                    {
                      email: email.trim().toLowerCase(),
                      role,
                      full_name: fullName.trim() || null,
                      note: note.trim() || null,
                    },
                    { onSuccess: close }
                  )
                }
              >
                {approve.isPending ? "Approving…" : "Approve access"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-emails">Email addresses</Label>
              <Textarea
                id="bulk-emails"
                rows={6}
                placeholder={"one@org.com\ntwo@org.com, three@org.com"}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separate with commas, spaces, or new lines. All are approved as judges.
              </p>
              {validBulk.length > 0 && (
                <p className="text-xs text-success">
                  {validBulk.length} valid address{validBulk.length === 1 ? "" : "es"}
                </p>
              )}
              {invalidBulk.length > 0 && (
                <p className="text-xs text-destructive">Ignoring {invalidBulk.length} invalid entr{invalidBulk.length === 1 ? "y" : "ies"}: {invalidBulk.slice(0, 3).join(", ")}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                disabled={validBulk.length === 0 || bulkApprove.isPending}
                onClick={() => bulkApprove.mutate({ emails: validBulk, role: "judge" }, { onSuccess: close })}
              >
                {bulkApprove.isPending ? "Approving…" : `Approve ${validBulk.length || ""} email${validBulk.length === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
