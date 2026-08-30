import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

/** Circular All In One Wellness — Family Health Club (Shri Chatap) brand mark. */
export function BrandLogo({ className, alt = "All In One Wellness — Family Health Club" }: BrandLogoProps) {
  return (
    <img
      src="/app-icon-512.png"
      alt={alt}
      className={cn("h-9 w-9 shrink-0 rounded-full bg-white object-contain", className)}
    />
  );
}
