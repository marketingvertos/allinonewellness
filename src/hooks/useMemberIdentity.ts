import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MemberIdentity {
  isStaff: boolean;
  memberId: string | null;
  memberName: string | null;
}

/** Resolves whether the signed-in user is CRM staff or a wellness member. */
export function useMemberIdentity() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["member-identity", user?.id],
    enabled: !!user,
    staleTime: 30 * 1000,
    retry: 2,
    queryFn: async (): Promise<MemberIdentity> => {
      const [rolesRes, memberRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.from("wellness_members").select("id, full_name").eq("user_id", user!.id).maybeSingle(),
      ]);
      // A failed lookup must not be mistaken for "this account has no access".
      if (rolesRes.error) throw rolesRes.error;
      if (memberRes.error) throw memberRes.error;
      return {
        isStaff: (rolesRes.data?.length ?? 0) > 0,
        memberId: memberRes.data?.id ?? null,
        memberName: memberRes.data?.full_name ?? null,
      };
    },
  });

}

/** 10-digit Indian mobile number -> deterministic credential address. */
export function mobileToEmail(mobile: string) {
  return `${normalizeMobile(mobile)}@members.vertos.in`;
}

export function normalizeMobile(mobile: string) {
  const digits = mobile.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
