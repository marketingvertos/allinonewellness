import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MemberAccessStatus {
  hasLogin: boolean;
  loginId: string;
}

export interface MemberCredentials {
  loginId: string;
  password: string;
}

async function callMemberAccess<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("member-access", { body: payload });
  if (error) {
    const detail = (data as { error?: string } | null)?.error;
    throw new Error(detail || error.message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export function useMemberAccessStatus(memberId?: string) {
  return useQuery({
    queryKey: ["member-access", memberId],
    enabled: !!memberId,
    queryFn: () => callMemberAccess<MemberAccessStatus>({ action: "status", memberId }),
  });
}

export interface MemberWithoutLogin {
  id: string;
  full_name: string;
  mobile_number: string;
}

/** Active members (leads excluded) that still have no portal login. */
export function useMembersWithoutLogin() {
  return useQuery({
    queryKey: ["members-without-login"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const res = await callMemberAccess<{ members: MemberWithoutLogin[] }>({ action: "missing_logins" });
      return res.members ?? [];
    },
  });
}

/** Issues portal logins for every member that is missing one. */
export function useCreateMissingLogins() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () =>
      callMemberAccess<{
        created: MemberWithoutLogin[];
        failed: { full_name: string; mobile_number: string; error: string }[];
        password: string;
      }>({ action: "create_missing" }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["members-without-login"] });
      qc.invalidateQueries({ queryKey: ["wellness-members"] });
      toast({
        title: `${data.created.length} login${data.created.length === 1 ? "" : "s"} created`,
        description: data.failed.length
          ? `${data.failed.length} could not be created — check their mobile numbers.`
          : `Password: ${data.password}`,
      });
    },
    onError: (error: Error) =>
      toast({ title: "Could not create logins", description: error.message, variant: "destructive" }),
  });
}

/**
 * Creates the member's portal login if they don't already have one.
 * Safe to call repeatedly — never throws at the caller, so it can't block a sale.
 */
export async function ensureMemberLogin(memberId: string) {
  try {
    return await callMemberAccess<{ status: string; loginId: string; password?: string }>({
      action: "ensure",
      memberId,
    });
  } catch {
    return null;
  }
}

/** Creates or resets the member's portal login. Returns the credentials to hand over. */
export function useManageMemberLogin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (vars: { memberId: string; action: "create" | "reset" | "unlink"; password?: string }) =>
      callMemberAccess<MemberCredentials>(vars),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["member-access", vars.memberId] });
      qc.invalidateQueries({ queryKey: ["wellness-members"] });
      qc.invalidateQueries({ queryKey: ["wellness-member"] });
      toast({
        title:
          vars.action === "create"
            ? "Portal login created"
            : vars.action === "reset"
              ? "Password reset"
              : "Portal access removed",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Could not update login", description: error.message, variant: "destructive" }),
  });
}
