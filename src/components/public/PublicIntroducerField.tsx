import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Check, X } from "lucide-react";

export interface IntroducerValue {
  referred_by_member_id: string;
  referrer_name: string;
  referrer_mobile: string;
}

export const emptyIntroducer: IntroducerValue = { referred_by_member_id: "", referrer_name: "", referrer_mobile: "" };

interface Props {
  value: IntroducerValue;
  onChange: (v: IntroducerValue) => void;
}

/** Public "Who introduced you?" — search club members by name, or enter someone else. */
export function PublicIntroducerField({ value, onChange }: Props) {
  const [mode, setMode] = useState<"member" | "other">("member");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (mode !== "member" || picked || term.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.functions.invoke("public-register", {
        body: { action: "search_referrers", term },
      });
      setResults((data as { results?: { id: string; label: string }[] })?.results ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [term, mode, picked]);

  const switchMode = (m: "member" | "other") => {
    setMode(m);
    setPicked(null);
    setTerm("");
    onChange(emptyIntroducer);
  };

  return (
    <div className="space-y-2">
      <Label>Who introduced you? (optional)</Label>
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && switchMode(v as "member" | "other")}
        className="justify-start flex-wrap"
      >
        <ToggleGroupItem value="member" variant="outline" className="px-4">Club member</ToggleGroupItem>
        <ToggleGroupItem value="other" variant="outline" className="px-4">Someone else</ToggleGroupItem>
      </ToggleGroup>

      {mode === "member" ? (
        picked ? (
          <div className="flex items-center justify-between rounded-md border bg-secondary/40 px-3 py-2 text-sm">
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{picked}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setPicked(null); setTerm(""); onChange(emptyIntroducer); }}
              aria-label="Clear introducer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Type the member's name (3+ letters)"
              maxLength={40}
              autoComplete="off"
            />
            {results.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full rounded px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setPicked(r.label);
                        setResults([]);
                        onChange({ ...emptyIntroducer, referred_by_member_id: r.id });
                      }}
                    >
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {term.trim().length >= 3 && results.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                No match yet. Not a club member? Choose "Someone else".
              </p>
            )}
          </div>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Their name"
            maxLength={100}
            value={value.referrer_name}
            onChange={(e) => onChange({ ...value, referred_by_member_id: "", referrer_name: e.target.value })}
          />
          <Input
            placeholder="Their mobile number"
            inputMode="numeric"
            maxLength={15}
            value={value.referrer_mobile}
            onChange={(e) => onChange({ ...value, referred_by_member_id: "", referrer_mobile: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
