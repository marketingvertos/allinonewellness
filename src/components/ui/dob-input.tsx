import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ageFromDob } from "@/lib/formatters";

interface Props {
  /** YYYY-MM-DD or "" */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** Show "Age: XX years" underneath. */
  showAge?: boolean;
  className?: string;
  disabled?: boolean;
}

function pad(n: string, len: number) {
  return n.padStart(len, "0");
}

function toIso(d: string, m: string, y: string): string {
  if (d.length < 1 || m.length < 1 || y.length !== 4) return "";
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!day || !month || month > 12 || day > 31 || year < 1900) return "";
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return "";
  return `${pad(String(year), 4)}-${pad(String(month), 2)}-${pad(String(day), 2)}`;
}

/**
 * Indian-format DD / MM / YYYY entry with auto-advancing segments plus a
 * calendar popover. Emits ISO `YYYY-MM-DD` (or "" while incomplete).
 */
export function DobInput({ value, onChange, id, showAge = true, className, disabled }: Props) {
  const [day, setDay] = React.useState("");
  const [month, setMonth] = React.useState("");
  const [year, setYear] = React.useState("");
  const monthRef = React.useRef<HTMLInputElement>(null);
  const yearRef = React.useRef<HTMLInputElement>(null);
  const dayRef = React.useRef<HTMLInputElement>(null);

  // sync down from the outside value
  React.useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) {
      const [y, m, d] = value.slice(0, 10).split("-");
      setDay(d);
      setMonth(m);
      setYear(y);
    } else if (!value) {
      setDay("");
      setMonth("");
      setYear("");
    }
  }, [value]);

  const emit = (d: string, m: string, y: string) => {
    const iso = toIso(d, m, y);
    if (iso !== value) onChange(iso);
  };

  const digitsOnly = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);

  const onDay = (raw: string) => {
    const v = digitsOnly(raw, 2);
    setDay(v);
    emit(v, month, year);
    if (v.length === 2 || (v.length === 1 && Number(v) > 3)) monthRef.current?.focus();
  };
  const onMonth = (raw: string) => {
    const v = digitsOnly(raw, 2);
    setMonth(v);
    emit(day, v, year);
    if (v.length === 2 || (v.length === 1 && Number(v) > 1)) yearRef.current?.focus();
  };
  const onYear = (raw: string) => {
    const v = digitsOnly(raw, 4);
    setYear(v);
    emit(day, month, v);
  };

  const back = (current: string, prev: React.RefObject<HTMLInputElement>) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && current === "") prev.current?.focus();
    };

  const selected = value && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))
    ? new Date(`${value.slice(0, 10)}T00:00:00`)
    : undefined;
  const age = showAge ? ageFromDob(value) : null;

  const seg =
    "h-10 w-full bg-transparent text-center text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
        <input
          id={id}
          ref={dayRef}
          inputMode="numeric"
          placeholder="DD"
          aria-label="Day"
          className={cn(seg, "max-w-[2.75rem]")}
          value={day}
          disabled={disabled}
          onChange={(e) => onDay(e.target.value)}
          onBlur={() => day.length === 1 && setDay(pad(day, 2))}
        />
        <span className="text-muted-foreground">/</span>
        <input
          ref={monthRef}
          inputMode="numeric"
          placeholder="MM"
          aria-label="Month"
          className={cn(seg, "max-w-[2.75rem]")}
          value={month}
          disabled={disabled}
          onChange={(e) => onMonth(e.target.value)}
          onKeyDown={back(month, dayRef)}
          onBlur={() => month.length === 1 && setMonth(pad(month, 2))}
        />
        <span className="text-muted-foreground">/</span>
        <input
          ref={yearRef}
          inputMode="numeric"
          placeholder="YYYY"
          aria-label="Year"
          className={cn(seg, "max-w-[4rem]")}
          value={year}
          disabled={disabled}
          onChange={(e) => onYear(e.target.value)}
          onKeyDown={back(year, monthRef)}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={disabled}>
              <CalendarIcon className="h-4 w-4" />
              <span className="sr-only">Open calendar</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected ?? new Date(1995, 0, 1)}
              captionLayout="dropdown-buttons"
              fromYear={1920}
              toYear={new Date().getFullYear()}
              onSelect={(d) => {
                if (!d) return;
                const iso = `${d.getFullYear()}-${pad(String(d.getMonth() + 1), 2)}-${pad(String(d.getDate()), 2)}`;
                onChange(iso);
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
      {showAge && age !== null && (
        <p className="text-xs text-muted-foreground">Age: {age} years</p>
      )}
    </div>
  );
}
