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
