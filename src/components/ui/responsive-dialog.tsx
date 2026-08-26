import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Sticky action bar rendered at the bottom of the surface. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Renders a centered dialog on desktop and a full-width bottom sheet on phones,
 * with a scrollable body and a sticky footer so primary actions stay reachable.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "flex max-h-[92svh] flex-col gap-0 rounded-t-2xl p-0",
            className,
          )}
        >
          <SheetHeader className="space-y-1 border-b px-4 pb-3 pt-4 text-left">
            <SheetTitle className="text-base">{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 [&>button]:w-full">
              {footer}
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-lg", className)}>
        <DialogHeader className="space-y-1 border-b px-6 pb-4 pt-6 text-left">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t px-6 py-4">{footer}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
