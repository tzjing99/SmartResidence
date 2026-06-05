import { redirect } from 'next/navigation';

export default function AdminRolesRedirectPage() {
  redirect('/admin/settings/roles');
}
