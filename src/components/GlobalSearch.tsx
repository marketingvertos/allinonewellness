import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Users, ClipboardList, Layers, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      setMembers([]); setPlans([]); setBatches([]);
      return;
    }
    const pattern = `%${term}%`;
    const [m, p, b] = await Promise.all([
      supabase
        .from("wellness_members")
        .select("id, full_name, mobile_number, status")
        .eq("is_guest", false)
        .or(`full_name.ilike.${pattern},mobile_number.ilike.${pattern}`)
        .limit(6),
      supabase.from("wellness_plans").select("id, name, plan_type").ilike("name", pattern).limit(5),
      supabase.from("wellness_batches").select("id, name, status").ilike("name", pattern).limit(5),
    ]);
    setMembers(m.data || []);
    setPlans(p.data || []);
    setBatches(b.data || []);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 200);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  const hasResults = members.length > 0 || plans.length > 0 || batches.length > 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search members…</span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search members, plans, batches…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {!hasResults && <CommandEmpty>No results found.</CommandEmpty>}

          {members.length > 0 && (
            <CommandGroup heading="Members">
              {members.map((m) => (
                <CommandItem key={m.id} value={`member-${m.id}`} onSelect={() => go(`/members?q=${encodeURIComponent(m.mobile_number)}`)}>
                  <Users className="mr-2 h-4 w-4" />
                  <span className="truncate">{m.full_name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{m.mobile_number}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {plans.length > 0 && (
            <CommandGroup heading="Plans">
              {plans.map((p) => (
                <CommandItem key={p.id} value={`plan-${p.id}`} onSelect={() => go("/plans")}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  <span className="truncate">{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {batches.length > 0 && (
            <CommandGroup heading="Batches">
              {batches.map((b) => (
                <CommandItem key={b.id} value={`batch-${b.id}`} onSelect={() => go("/batches")}>
                  <Layers className="mr-2 h-4 w-4" />
                  <span className="truncate">{b.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
