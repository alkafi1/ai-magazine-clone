import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@aimag/shared';
import { Badge, Card, Field, Flash, PageHeader, button, inputCls } from '@/components/admin/ui';
import { getMe } from '@/lib/admin';
import { changePassword, updateProfile } from '../../actions';

export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const me = await getMe();
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="My account"
        description={me.email}
        actions={<Badge tone="violet">{ROLE_LABELS[me.role]}</Badge>}
      />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <form action={updateProfile} className="space-y-4">
            <Field label="Display name" htmlFor="name">
              <input
                id="name"
                name="name"
                maxLength={100}
                defaultValue={me.name}
                className={inputCls}
              />
            </Field>
            <button className={button('primary')}>Save</button>
          </form>
          <p className="mt-5 text-sm text-slate-600">
            <strong className="text-slate-900">{ROLE_LABELS[me.role]}.</strong>{' '}
            {ROLE_DESCRIPTIONS[me.role]}
          </p>
        </Card>
        <Card
          title="Change password"
          description="You will stay signed in here; every other session is signed out."
        >
          <form action={changePassword} className="space-y-4">
            <Field label="Current password" htmlFor="current">
              <input
                id="current"
                name="current"
                type="password"
                required
                autoComplete="current-password"
                className={inputCls}
              />
            </Field>
            <Field
              label="New password"
              htmlFor="password"
              hint="At least 12 characters. A passphrase of several words works well."
            >
              <input
                id="password"
                name="password"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>
            <Field label="Repeat new password" htmlFor="confirm">
              <input
                id="confirm"
                name="confirm"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>
            <button className={button('primary')}>Change password</button>
          </form>
        </Card>
      </div>
    </>
  );
}
