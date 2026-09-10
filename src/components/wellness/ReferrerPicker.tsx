import { useState } from "react";
import { useMemberSearch } from "@/hooks/useAchievements";
import { useReferralNetwork } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";

interface Props {
  value: string | null;
  onChange: (id: string | null, name?: string) => void;
  excludeId?: string;
  placeholder?: string;
}

export function ReferrerPicker({ value, onChange, excludeId, placeholder = "Search member by name or mobile" }: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { data: results, isLoading } = useMemberSearch(term, excludeId);
  // A member cannot be referred by someone inside their own downstream network.
  const { data: ownNetwork } = useReferralNetwork(excludeId);
  const blocked = new Set((ownNetwork ?? []).map((n) => n.member_id));
  const options = (results ?? []).filter((r) => !blocked.has(r.id));

  const selected = options.find((r) => r.id === value);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
            <span className={value ? "" : "text-muted-foreground"}>
              {selected ? `${selected.full_name} · ${selected.mobile_number}` : value ? "Selected member" : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Type a name or mobile number" value={term} onValueChange={setTerm} />
            <CommandList>
              {isLoading ? null : <CommandEmpty>No matching member.</CommandEmpty>}
              <CommandGroup>
                {options.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={r.id}
                    onSelect={() => {
                      onChange(r.id, r.full_name);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === r.id ? "opacity-100" : "opacity-0"}`} />
                    <span className="flex-1">{r.full_name}</span>
                    <span className="text-xs text-muted-foreground">{r.mobile_number}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Clear referrer">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
