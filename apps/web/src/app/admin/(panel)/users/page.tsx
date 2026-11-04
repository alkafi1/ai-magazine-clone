import {
  PERMISSIONS,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  canManageRole,
  type Permission,
  type Role,
} from '@aimag/shared';
import { ConfirmButton } from '@/components/admin/ConfirmDialog';
import {
  Badge,
  Card,
  Field,
  Flash,
  PageHeader,
  Td,
  Th,
  button,
  fmtRelative,
  inputCls,
  type Tone,
} from '@/components/admin/ui';
import { adminApi, can, guard } from '@/lib/admin';
import { createUser, deleteUser, resetUserPassword, updateUser } from '../../actions';

type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  locked: boolean;
  lastLoginAt: string | null;
};
const roleTone: Record<Role, Tone> = {
  super_admin: 'violet',
  admin: 'blue',
  editor: 'green',
  moderator: 'yellow',
  ad_manager: 'yellow',
  viewer: 'gray',
};

const PERM_LABELS: Record<Permission, string> = {
  'dashboard.view': 'View dashboard',
  'articles.view': 'View articles',
  'articles.moderate': 'Hide / restore / take down',
  'articles.feature': 'Feature stories',
  'articles.seo': 'Edit SEO',
  'scrape.view': 'View scrape runs',
  'scrape.run': 'Run scraper',
  'subscribers.view': 'View subscribers',
  'subscribers.manage': 'Export / delete subscribers',
  'settings.manage': 'Site settings',
  'ads.manage': 'Manage ads',
  'users.view': 'View users',
  'users.manage': 'Manage users',
  'audit.view': 'View audit log',
};

export default async function UsersAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const me = await guard('users.view');
  const sp = await searchParams;
  const { items } = await adminApi<{ items: User[] }>('/users');
  const manage = can(me, 'users.manage');

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Who can sign in, and what each role is allowed to do. Changes apply to their very next request."
      />
      <Flash ok={sp.ok} err={sp.err} />

      <Card padded={false} title={`${items.length} account${items.length === 1 ? '' : 's'}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <caption className="sr-only">Admin accounts</caption>
            <thead className="bg-slate-50">
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                {manage && <Th>Manage</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((u) => {
                const isMe = u.id === me.id;
                const editable = manage && !isMe && canManageRole(me.role, u.role);
                return (
                  <tr key={u.id} className={u.active ? '' : 'bg-slate-50/70'}>
                    <Td>
                      <p className="font-semibold text-slate-900">
                        {u.name || u.email.split('@')[0]}{' '}
                        {isMe && <span className="text-xs font-normal text-slate-500">(you)</span>}
                      </p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </Td>
                    <Td>
                      <Badge tone={roleTone[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                    </Td>
                    <Td>
                      {!u.active ? (
                        <Badge tone="gray">Disabled</Badge>
                      ) : u.locked ? (
                        <Badge tone="red">Locked</Badge>
                      ) : (
                        <Badge tone="green">Active</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{fmtRelative(u.lastLoginAt)}</Td>
                    {manage && (
                      <Td>
                        {editable ? (
                          <details className="group">
                            <summary className="cursor-pointer list-none text-sm font-semibold text-wire-dark hover:underline">
                              Manage ▾
                            </summary>
                            <div className="mt-3 w-72 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <form action={updateUser} className="space-y-2">
                                <input type="hidden" name="id" value={u.id} />
                                <label
                                  htmlFor={`role-${u.id}`}
                                  className="text-xs font-medium text-slate-700"
                                >
                                  Role
                                </label>
                                <select
                                  id={`role-${u.id}`}
                                  name="role"
                                  defaultValue={u.role}
                                  className={inputCls}
                                >
                                  {me.assignableRoles.map((r) => (
                                    <option key={r} value={r}>
                                      {ROLE_LABELS[r]}
                                    </option>
                                  ))}
                                </select>
                                <button className={button('secondary', true)}>Change role</button>
                              </form>
                              <div className="flex flex-wrap gap-2">
                                <form action={updateUser}>
                                  <input type="hidden" name="id" value={u.id} />
                                  <input type="hidden" name="active" value={String(!u.active)} />
                                  <button className={button('secondary', true)}>
                                    {u.active ? 'Disable' : 'Enable'}
                                  </button>
                                </form>
                                {u.locked && (
                                  <form action={updateUser}>
                                    <input type="hidden" name="id" value={u.id} />
                                    <input type="hidden" name="unlock" value="true" />
                                    <button className={button('secondary', true)}>Unlock</button>
                                  </form>
                                )}
                              </div>
                              <form action={resetUserPassword} className="space-y-2">
                                <input type="hidden" name="id" value={u.id} />
                                <label
                                  htmlFor={`pw-${u.id}`}
                                  className="text-xs font-medium text-slate-700"
                                >
                                  Set a new password (12+ characters)
                                </label>
                                <input
                                  id={`pw-${u.id}`}
                                  name="password"
                                  type="password"
                                  minLength={12}
                                  required
                                  autoComplete="new-password"
                                  className={inputCls}
                                />
                                <button className={button('secondary', true)}>
                                  Reset password
                                </button>
                              </form>
                              <form action={deleteUser}>
                                <input type="hidden" name="id" value={u.id} />
                                <ConfirmButton
                                  label="Delete account"
                                  title={`Delete ${u.email}?`}
                                  message="The account is removed and its sessions end immediately. Their past actions stay in the audit log."
                                  confirmLabel="Delete"
                                  className={button('dangerOutline', true)}
                                  danger
                                />
                              </form>
                            </div>
                          </details>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {isMe ? 'Use My account' : '—'}
                          </span>
                        )}
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {manage && (
        <Card
          title="Add a user"
          description="They sign in with this email and password, then should change it under My account."
          className="mt-6"
        >
          <form action={createUser} className="grid gap-4 md:grid-cols-2">
            <Field label="Email" htmlFor="new-email">
              <input id="new-email" name="email" type="email" required className={inputCls} />
            </Field>
            <Field label="Name" htmlFor="new-name">
              <input id="new-name" name="name" maxLength={100} className={inputCls} />
            </Field>
            <Field label="Role" htmlFor="new-role">
              <select id="new-role" name="role" defaultValue="viewer" className={inputCls}>
                {me.assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Temporary password"
              htmlFor="new-password"
              hint="12+ characters. Share it over a secure channel."
            >
              <input
                id="new-password"
                name="password"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>
            <div className="md:col-span-2">
              <button className={button('primary')}>Create account</button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="What each role can do"
        description="Roles are fixed so they stay easy to audit. You can only hand out roles below your own."
        className="mt-6"
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Permissions by role</caption>
            <thead className="bg-slate-50">
              <tr>
                <Th>Permission</Th>
                {ROLES.map((r) => (
                  <Th key={r} className="text-center">
                    {ROLE_LABELS[r]}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PERMISSIONS.map((p) => (
                <tr key={p}>
                  <Td>{PERM_LABELS[p]}</Td>
                  {ROLES.map((r) => (
                    <Td key={r} className="text-center">
                      {ROLE_PERMISSIONS[r].includes(p) ? (
                        <span aria-label="allowed" className="font-bold text-emerald-600">
                          ✓
                        </span>
                      ) : (
                        <span aria-label="not allowed" className="text-slate-300">
                          –
                        </span>
                      )}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="grid gap-2 border-t border-slate-100 p-5 text-sm text-slate-600 md:grid-cols-2">
          {ROLES.map((r) => (
            <li key={r}>
              <strong className="text-slate-900">{ROLE_LABELS[r]}.</strong> {ROLE_DESCRIPTIONS[r]}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
