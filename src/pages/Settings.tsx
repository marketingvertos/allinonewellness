import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ConnectorSettings } from "@/components/settings/ConnectorSettings";
import { WhatsAppSettings } from "@/components/settings/WhatsAppSettings";

const TABS = ["profile", "team", "notifications", "whatsapp", "connectors"] as const;

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") ?? "profile";
  const tab = (TABS as readonly string[]).includes(raw) ? raw : "profile";

  const setTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, team and wellness centre preferences.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
        </TabsList>

        <TabsContent value="profile"><ProfileSettings /></TabsContent>
        <TabsContent value="team"><TeamSettings /></TabsContent>
        <TabsContent value="notifications"><NotificationSettings /></TabsContent>
        <TabsContent value="whatsapp"><WhatsAppSettings /></TabsContent>
        <TabsContent value="connectors"><ConnectorSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
