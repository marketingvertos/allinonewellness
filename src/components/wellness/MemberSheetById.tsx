import { useWellnessMember } from "@/hooks/useWellness";
import { MemberDetailSheet } from "./MemberDetailSheet";

interface Props {
  memberId: string | null;
  onClose: () => void;
}

export function MemberSheetById({ memberId, onClose }: Props) {
  const { data: member } = useWellnessMember(memberId ?? undefined);
  if (!memberId || !member) return null;
  return <MemberDetailSheet member={member} open onOpenChange={(o) => !o && onClose()} />;
}
