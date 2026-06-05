import { redirect } from 'next/navigation';

/** Settings hub — default to helpdesk & SLA configuration. */
export default function AdminSettingsIndexPage() {
  redirect('/admin/settings/helpdesk');
}
