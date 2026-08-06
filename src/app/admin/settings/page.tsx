import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminSettingsClient } from "@/components/admin-settings-client";

export default function SettingsPage() {
  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="Settings"
          description="Manage your admin password and email-based recovery."
        />
      }
    >
      <AdminSettingsClient />
    </AdminPageLayout>
  );
}
