import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { useSendWhatsApp } from "@/hooks/useWhatsApp";

interface Props {
  memberId: string;
  memberName: string;
  mobileNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendWhatsAppDialog({
  memberId,
  memberName,
  mobileNumber,
  open,
  onOpenChange,
}: Props) {
  const [text, setText] = useState("");
  const send = useSendWhatsApp();
  const digits = mobileNumber.replace(/\D/g, "").slice(-10);

  const submit = () => {
    if (!text.trim()) return;
    send.mutate(
      {
        member_id: memberId,
        message_content: text.trim(),
        source_module: "manual",
      },
      {
        onSuccess: () => {
          setText("");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>WhatsApp {memberName}</DialogTitle>
          <DialogDescription>
            Sent from the centre's WhatsApp number to +91 {digits}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="wa-text">Message</Label>
          <Textarea
            id="wa-text"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message…"
          />
          <p className="text-xs text-muted-foreground">
            Free-text messages reach a member only within 24 hours of their last reply.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!text.trim() || send.isPending}>
            {send.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
