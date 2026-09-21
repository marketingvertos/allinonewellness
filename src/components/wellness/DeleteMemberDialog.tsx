import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useDeleteMember } from "@/hooks/useMemberAccess";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  memberId: string;
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

/** Irreversible removal of a member profile — full admins only. */
export function DeleteMemberDialog({ memberId, memberName, open, onOpenChange, onDeleted }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const remove = useDeleteMember();

  const matches = confirmText.trim().toLowerCase() === memberName.trim().toLowerCase();

  const handleOpenChange = (next: boolean) => {
    if (!next) setConfirmText("");
    onOpenChange(next);
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync({ memberId });
      setConfirmText("");
      onOpenChange(false);
      onDeleted?.();
    } catch {
      /* toast handled in the hook */
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Delete {memberName} permanently?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>This cannot be undone. Everything below will be erased for this member:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                <li>Check-ins and visit history</li>
                <li>Memberships, servings and payment records</li>
                <li>Weight readings and body evaluations</li>
                <li>Pink Card balance and history</li>
                <li>Notes, badges and WhatsApp history links</li>
                <li>Their app login</li>
              </ul>
              <p>Members they referred are kept — only the referral link is cleared.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete-member">
            Type <span className="font-semibold">{memberName}</span> to confirm
          </Label>
          <Input
            id="confirm-delete-member"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={memberName}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleDelete();
            }}
            disabled={!matches || remove.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {remove.isPending ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
