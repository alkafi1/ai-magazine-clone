import { CUSTOM_ROLE_MAX_RANK, PERMISSIONS, type Permission, type RoleDef } from '@aimag/shared';
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
  inputCls,
} from '@/components/admin/ui';
import { adminApi, can, guard, type Me } from '@/lib/admin';
import { PERM_GROUPS, PERM_LABELS } from '@/lib/perm-labels';
import { deleteRole, saveRole } from '../../actions-content';

type RoleRow = RoleDef & { users: number };

function RoleForm({ me, role, openId }: { me: Me; role?: RoleRow; openId: string }) {
  const sup = me.role === 'super_admin';
  const maxRank = sup ? CUSTOM_ROLE_MAX_RANK : Math.min(CUSTOM_ROLE_MAX_RANK, me.rank - 1);
  return (
    <form action={saveRole} className="space-y-5">
      <input type="hidden" name="_open" value={openId} />
      {role && <input type="hidden" name="key" value={role.key} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label="Role name" htmlFor={`${openId}-name`}>
            <input
              id={`${openId}-name`}
              name="name"
              required
              minLength={2}
              maxLength={40}
              defaultValue={role?.name}
              className={inputCls}
            />
          </Field>
        </div>
        <Field
          label="Rank"
          htmlFor={`${openId}-rank`}
          hint={`1–${maxRank}. Higher = more authority.`}
        >
          <input
            id={`${openId}-rank`}
            name="rank"
            type="number"
            required
            min={1}
            max={maxRank}
            defaultValue={role?.rank ?? Math.min(40, maxRank)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Description" htmlFor={`${openId}-desc`}>
        <input
          id={`${openId}-desc`}
          name="description"
          maxLength={200}
          defaultValue={role?.description}
          className={inputCls}
        />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Permissions</legend>
        <p className="text-xs text-slate-500">You can only grant permissions you have yourself.</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {PERM_GROUPS.map((g) => (
            <div key={g.title} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {g.title}
              </p>
              <ul className="mt-2 space-y-1.5">
                {g.perms.map((p) => {
                  const held = me.permissions.includes(p);
                  return (
                    <li key={p}>
                      <label
                        className={`flex items-start gap-2 text-sm ${held ? 'text-slate-800' : 'text-slate-400'}`}
                      >
                        <input
                          type="checkbox"
                          name="perm"
                          value={p}
                          defaultChecked={role?.permissions.includes(p)}
                          disabled={!held}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <span>
                          {PERM_LABELS[p]}
                          {!held && <span className="ml-1 text-xs">(you don’t have this)</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" data-close className={button('secondary')}>
          Cancel
        </button>
        <button className={button('primary')}>{role ? 'Save role' : 'Create role'}</button>
      </div>
    </form>
  );
}

export default async function RolesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; open?: string }>;
}) {
  const me = await guard('users.view');
  const sp = await searchParams;
  const { items } = await adminApi<{ items: RoleRow[] }>('/roles');
  const manage = can(me, 'roles.manage');
  const mayEdit = (r: RoleRow) =>
    manage && !r.builtin && (me.role === 'super_admin' || me.rank > r.rank);

  return (
    <>
      <PageHeader
        title="Roles"
        description="Built-in roles are fixed. Create your own with exactly the permissions you want; changes apply to everyone holding the role immediately."
        actions={
          manage && (
            <Modal
              trigger="New role"
              title="Create a role"
              description="Pick a name, a rank and what this role may do."
              size="lg"
              defaultOpen={sp.open === 'role-new'}
            >
              <RoleForm me={me} openId="role-new" />
            </Modal>
          )
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      <Card padded={false}>
        <TableScroll label="Roles">
          <table className="w-full min-w-[720px]">
            <caption className="sr-only">Roles</caption>
            <thead className="bg-slate-50">
              <tr>
                <Th>Role</Th>
                <Th>Rank</Th>
                <Th>Permissions</Th>
                <Th>Users</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((r) => (
                <tr key={r.key}>
                  <Td>
                    <p className="font-semibold text-slate-900">
                      {r.name}{' '}
                      {r.builtin ? <Badge>Built-in</Badge> : <Badge tone="blue">Custom</Badge>}
                    </p>
                    <p className="max-w-md text-xs text-slate-500">
                      {r.description || <span className="italic">No description</span>}
                    </p>
                  </Td>
                  <Td>{r.rank}</Td>
                  <Td>
                    {r.permissions.length} of {PERMISSIONS.length}
                  </Td>
                  <Td>{r.users}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      {mayEdit(r) ? (
                        <>
                          <Modal
                            trigger="Edit"
                            title={`Edit role: ${r.name}`}
                            size="lg"
                            triggerClassName={button('secondary', true)}
                            defaultOpen={sp.open === `role-${r.key}`}
                          >
                            <RoleForm me={me} role={r} openId={`role-${r.key}`} />
                          </Modal>
                          <form action={deleteRole}>
                            <input type="hidden" name="key" value={r.key} />
                            <ConfirmButton
                              label="Delete"
                              title={`Delete “${r.name}”?`}
                              message={
                                r.users
                                  ? `${r.users} account(s) use this role, so it cannot be deleted until they are moved.`
                                  : 'This cannot be undone.'
                              }
                              confirmLabel="Delete role"
                              className={button('dangerOutline', true)}
                              danger
                            />
                          </form>
                        </>
                      ) : (
                        <Modal
                          trigger="View"
                          title={`Role: ${r.name}`}
                          triggerClassName={button('secondary', true)}
                        >
                          <ul className="space-y-1.5 text-sm">
                            {(r.permissions as Permission[]).map((p) => (
                              <li key={p} className="flex gap-2">
                                <span className="font-bold text-emerald-600" aria-hidden="true">
                                  ✓
                                </span>
                                {PERM_LABELS[p]}
                              </li>
                            ))}
                          </ul>
                        </Modal>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </>
  );
}
