import * as React from "react";
import { BrandLogo } from "@/components/BrandLogo";

interface DisplayLayoutProps {
  title: string;
  filters?: React.ReactNode;
  children: React.ReactNode;
}

/** Full-screen, TV-optimised shell for the public display boards. */
export function DisplayLayout({ title, filters, children }: DisplayLayoutProps) {
  const [time, setTime] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const istTime = time.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="light min-h-screen bg-background p-4 text-foreground sm:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-10 w-10 sm:h-12 sm:w-12" />
          <span className="text-base font-semibold uppercase tracking-wide text-muted-foreground sm:text-lg">
            All In One Wellness
          </span>
        </div>
        <h1 className="order-last w-full text-center text-2xl font-bold tracking-tight sm:order-none sm:w-auto sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        <div className="text-right">
          <div className="text-xl font-semibold tabular-nums sm:text-2xl">{istTime}</div>
          <div className="text-xs text-muted-foreground">Updates every 60s</div>
        </div>
      </header>

      {filters && <div className="mb-5 flex flex-wrap items-center gap-2">{filters}</div>}

      <main className="pb-8">{children}</main>
    </div>
  );
}
