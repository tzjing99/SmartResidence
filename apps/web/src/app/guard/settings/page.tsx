import { Card } from '@smartresidence/ui-web';
import { Settings2 } from 'lucide-react';

/** Placeholder for guard-specific preferences on web. */
export default function GuardSettingsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="size-7 text-coral-500" /> Settings
        </h1>
        <p className="sr-muted mt-1">
          Guard preferences for the web gate console. Full check-in workflows live in the mobile app.
        </p>
      </header>
      <Card className="p-5">
        <p className="text-sm sr-muted">
          No guard-specific settings are available on web yet. Scanning, manual entry, and expected
          visitor lists are configured in the mobile guard app.
        </p>
      </Card>
    </div>
  );
}
