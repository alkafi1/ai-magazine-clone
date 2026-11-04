import Link from 'next/link';
import { PageHeader } from '@/components/admin/ui';

export default function Forbidden() {
  return (
    <>
      <PageHeader
        title="You don’t have access to that"
        description="Your role does not include this part of the admin. If you need it, ask a super admin to change your role."
      />
      <Link href="/admin" className="text-sm font-semibold text-wire-dark underline">
        Back to the dashboard
      </Link>
    </>
  );
}
