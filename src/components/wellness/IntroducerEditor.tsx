import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateWellnessMember, useWellnessMember } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ReferrerPicker } from "./ReferrerPicker";

interface Props {
  member: {
    id: string;
    referred_by_member_id?: string | null;
    referrer_name?: string | null;
    referrer_mobile?: string | null;
    referral_acquaintance?: string | null;
  };
  introducerLabel?: string | null;
}

/** Staff-only: shows and corrects who introduced this person (club member or someone outside). */
export function IntroducerEditor({ member, introducerLabel }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const update = useUpdateWellnessMember();
  const curId = member.referred_by_member_id ?? null;
  const curName = member.referrer_name ?? "";
  const curMobile = member.referrer_mobile ?? "";
  const curAcq = member.referral_acquaintance ?? null;
  const [mode, setMode] = useState<"member" | "other">(curId || !curName ? "member" : "other");
  const [refId, setRefId] = useState<string | null>(curId);
  const [name, setName] = useState(curName);
  const [mobile, setMobile] = useState(curMobile);
  const [referrerIsCoach, setReferrerIsCoach] = useState(false);
  const [acquaintance, setAcquaintance] = useState<string | null>(curAcq);

  const { data: referrerMember } = useWellnessMember(curId ?? undefined);
  useEffect(() => {
    if (referrerMember) setReferrerIsCoach((referrerMember.tags ?? []).includes("coach"));
  }, [referrerMember]);

  useEffect(() => {
    setMode(curId || !curName ? "member" : "other");
    setRefId(curId);
    setName(curName);
    setMobile(curMobile);
    setAcquaintance(curAcq);
  }, [member.id, curId, curName, curMobile, curAcq]);

  const nextAcq = mode === "member" && referrerIsCoach ? acquaintance : null;
  const next =
    mode === "member"
      ? { referred_by_member_id: refId, referrer_name: null, referrer_mobile: null, referral_acquaintance: nextAcq }
      : { referred_by_member_id: null, referrer_name: name.trim() || null, referrer_mobile: mobile.trim() || null, referral_acquaintance: null };
  const changed =
    next.referred_by_member_id !== curId ||
    (next.referrer_name ?? "") !== curName ||
    (next.referrer_mobile ?? "") !== curMobile ||
    (next.referral_acquaintance ?? null) !== (curAcq ?? null);

  const save = async () => {
    await update.mutateAsync({ id: member.id, ...next } as never);
    const desc =
      mode === "member"
        ? refId ? "a club member" : "nobody (cleared)"
        : `${next.referrer_name ?? "—"}${next.referrer_mobile ? ` · ${next.referrer_mobile}` : ""} (not a club member)`;
    await supabase.from("member_notes").insert({
      member_id: member.id,
      note: `Introducer updated to ${desc}`,
      created_by: user?.id,
    } as never);
    qc.invalidateQueries({ queryKey: ["member-notes"] });
    qc.invalidateQueries({ queryKey: ["introducer-report"] });
  };

  const shown = introducerLabel || (curName ? `${curName}${curMobile ? ` · ${curMobile}` : ""}` : null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Introduced by</p>
        {shown ? (
          <Badge variant="secondary">{shown}{!curId && curName ? " · outside" : ""}</Badge>
        ) : (
          <Badge variant="outline">Not recorded</Badge>
        )}
      </div>
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && setMode(v as "member" | "other")}
        className="justify-start flex-wrap"
      >
        <ToggleGroupItem value="member" variant="outline" className="px-4">Club member</ToggleGroupItem>
        <ToggleGroupItem value="other" variant="outline" className="px-4">Someone else</ToggleGroupItem>
      </ToggleGroup>
      {mode === "member" ? (
        <div className="space-y-3">
          <ReferrerPicker value={refId} excludeId={member.id} onChange={(id, _name, tags) => {
            setRefId(id);
            const isCoach = (tags ?? []).includes("coach");
            setReferrerIsCoach(isCoach);
            if (!isCoach) setAcquaintance(null);
          }} />
          {referrerIsCoach && refId && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Coach referral type: known circle or public invite?</p>
              <ToggleGroup
                type="single"
                value={acquaintance ?? ""}
                onValueChange={(v) => v && setAcquaintance(v)}
                className="justify-start flex-wrap"
              >
                <ToggleGroupItem value="known" variant="outline" className="px-4">Known</ToggleGroupItem>
                <ToggleGroupItem value="unknown" variant="outline" className="px-4">Unknown / Public</ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="intro-name">Person's name</Label>
            <Input id="intro-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="intro-mobile">Mobile number</Label>
            <Input id="intro-mobile" inputMode="numeric" maxLength={15} value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" disabled={!changed || update.isPending} onClick={save}>
          Save introducer
        </Button>
        <p className="text-xs text-muted-foreground">
          Club members get referral credit under the Pink Card rules; outside people do not.
        </p>
      </div>
    </div>
  );
}
