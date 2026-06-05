import { Card } from '@smartresidence/ui-web';
import { Bell } from 'lucide-react';

/** Placeholder for staff notification preferences. */
export default function AdminNotificationsSettingsPage() {
  return (
    <div className="max-w-lg flex flex-col gap-4">
      <div>
        <h2 className="sr-section-title flex items-center gap-2">
          <Bell className="size-5" /> Staff notifications
        </h2>
        <p className="sr-muted text-sm mt-1">
          Configure how management staff receive helpdesk and operational alerts.
        </p>
      </div>
      <Card className="p-5">
        <p className="text-sm sr-muted">
          Staff notification preferences are not configurable yet. In-app alerts are enabled by
          default for assigned helpdesk threads.
        </p>
      </Card>
    </div>
  );
}
