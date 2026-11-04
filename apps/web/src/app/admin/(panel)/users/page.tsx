import { PERMISSIONS, type RoleDef } from '@aimag/shared';
import { ConfirmButton } from '@/components/admin/ConfirmDialog';
import { Modal } from '@/components/admin/Modal';
import {
  Badge,
  Card,
  Field,
  Flash,
  PageHeader,
  TableScroll,
  Td,
  Th,
  button,
  fmtRelative,
  inputCls,
} from '@/components/admin/ui';
import { adminApi, can, guard } from '@/lib/admin';
import { PERM_LABELS } from '@/lib/perm-labels';
import { createUser, deleteUser, resetUserPassword, updateUser } from '../../actions';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleName: string;
  active: boolean;
  locked: boolean;
  lastLoginAt: string | null;
};

export default async function UsersAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; open?: string }>;
}) {
  const me = await guard('users.view');
  const sp = await searchParams;
  const [{ items }, { items: roles }] = await Promise.all([
    adminApi<{ items: User[] }>('/users'),
    adminApi<{ items: RoleDef[] }>('/roles'),
  ]);
  const manage = can(me, 'users.manage');
  const rank = new Map(roles.map((r) => [r.key, r.rank]));
  const outranks = (key: string) => me.role === 'super_admin' || me.rank > (rank.get(key) ?? 1000);

  return (
    <>
      <PageHeader
        title="Users"
        description="Who can sign in, and what each person may do. Changes apply to their very next request."
        actions={
          manage && (
            <Modal
              trigger="Add user"
              title="Add a user"
              description="They sign in with this email and password, then should change it under My account."
              defaultOpen={sp.open === 'user-new'}
            >
              <form action={createUser} className="space-y-4">
                <input type="hidden" name="_open" value="user-new" />
                <Field label="Email" htmlFor="new-email">
                  <input id="new-email" name="email" type="email" required className={inputCls} />
                </Field>
                <Field label="Name" htmlFor="new-name">
                  <input id="new-name" name="name" maxLength={100} className={inputCls} />
                </Field>
                <Field
                  label="Role"
                  htmlFor="new-role"
                  hint="You can only hand out roles below your own."
                >
                  <select id="new-role" name="role" defaultValue="viewer" className={inputCls}>
                    {me.assignableRoles.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name}
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
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button type="button" data-close className={button('secondary')}>
                    Cancel
                  </button>
                  <button className={button('primary')}>Create account</button>
                </div>
              </form>
            </Modal>
          )
        }
      />
      <Flash ok={sp.ok} err={sp.err} />

      <Card padded={false} title={`${items.length} account${items.length === 1 ? '' : 's'}`}>
        <TableScroll label="Admin accounts">
          <table className="w-full min-w-[760px]">
            <caption className="sr-only">Admin accounts</caption>
            <thead className="bg-slate-50">
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                {manage && <Th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((u) => {
                const isMe = u.id === me.id;
                const editable = manage && !isMe && outranks(u.role);
                const modalId = `user-${u.id}`;
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
                      <Badge
                        tone={
                          u.role === 'super_admin' ? 'violet' : u.role === 'admin' ? 'blue' : 'gray'
                        }
                      >
                        {u.roleName}
                      </Badge>
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
                      <Td className="text-right">
                        {editable ? (
                          <Modal
                            trigger="Manage"
                            title={u.name || u.email}
                            description={u.email}
                            triggerClassName={button('secondary', true)}
                            defaultOpen={sp.open === modalId}
                          >
                            <div className="space-y-6">
                              <form action={updateUser} className="space-y-3">
                                <input type="hidden" name="target" value={u.id} />
                                <input type="hidden" name="_open" value={modalId} />
                                <Field label="Role" htmlFor={`role-${u.id}`}>
                                  <select
                                    id={`role-${u.id}`}
                                    name="role"
                                    defaultValue={u.role}
                                    className={inputCls}
                                  >
                                    {me.assignableRoles.map((r) => (
                                      <option key={r.key} value={r.key}>
                                        {r.name}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <button className={button('primary', true)}>Change role</button>
                              </form>
                              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                                <form action={updateUser}>
                                  <input type="hidden" name="target" value={u.id} />
                                  <input type="hidden" name="active" value={String(!u.active)} />
                                  <button className={button('secondary')}>
                                    {u.active ? 'Disable account' : 'Enable account'}
                                  </button>
                                </form>
                                {u.locked && (
                                  <form action={updateUser}>
                                    <input type="hidden" name="target" value={u.id} />
                                    <input type="hidden" name="unlock" value="true" />
                                    <button className={button('secondary')}>Unlock</button>
                                  </form>
                                )}
                              </div>
                              <form
                                action={resetUserPassword}
                                className="space-y-3 border-t border-slate-100 pt-4"
                              >
                                <input type="hidden" name="target" value={u.id} />
                                <input type="hidden" name="_open" value={modalId} />
                                <Field
                                  label="Set a new password"
                                  htmlFor={`pw-${u.id}`}
                                  hint="12+ characters. Signs them out everywhere."
                                >
                                  <input
                                    id={`pw-${u.id}`}
                                    name="password"
                                    type="password"
                                    minLength={12}
                                    required
                                    autoComplete="new-password"
                                    className={inputCls}
                                  />
                                </Field>
                                <button className={button('secondary')}>Reset password</button>
                              </form>
                              <form action={deleteUser} className="border-t border-slate-100 pt-4">
                                <input type="hidden" name="target" value={u.id} />
                                <ConfirmButton
                                  label="Delete account"
                                  title={`Delete ${u.email}?`}
                                  message="The account is removed and its sessions end immediately. Their past actions stay in the audit log."
                                  confirmLabel="Delete"
                                  className={button('dangerOutline')}
                                  danger
                                />
                              </form>
                            </div>
                          </Modal>
                        ) : (
                          <span className="text-xs text-slate-500">
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
        </TableScroll>
      </Card>

      <Card
        title="What each role can do"
        description="Create your own roles under Roles."
        className="mt-6"
        padded={false}
      >
        <TableScroll label="Permissions by role">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Permissions by role</caption>
            <thead className="bg-slate-50">
              <tr>
                <Th>Permission</Th>
                {roles.map((r) => (
                  <Th key={r.key} className="text-center">
                    {r.name}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PERMISSIONS.map((p) => (
                <tr key={p}>
                  <Td>{PERM_LABELS[p]}</Td>
                  {roles.map((r) => (
                    <Td key={r.key} className="text-center">
                      {r.permissions.includes(p) ? (
                        <span aria-label="allowed" className="font-bold text-emerald-600">
                          ✓
                        </span>
                      ) : (
                        <span aria-label="not allowed" className="text-slate-400">
                          –
                        </span>
                      )}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </>
  );
}
