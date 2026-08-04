"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  MODULES,
  SPECIAL_PERMISSIONS,
} from "@/lib/authz/permissions";
import {
  useCreateRole,
  useDeleteRole,
  useRoles,
  useSetDefaultRole,
  useUpdateRole,
  type RoleData,
} from "@/hooks/use-roles";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/shared/loading-state";
import {
  SettingsBackLink,
  SettingsHeader,
  SettingsSection,
  SettingsShell,
} from "@/components/settings/settings-shell";

interface EditorState {
  role: RoleData | null;
}

export function RolesManager() {
  const t = useTranslations("roles.page");
  const { data, isLoading, isError, refetch } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const setDefaultRole = useSetDefaultRole();

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return (
      <div className="p-4 text-sm text-danger">
        {t("loadFailed")}{" "}
        <button type="button" onClick={() => refetch()} className="underline">
          {t("retry")}
        </button>
      </div>
    );
  }

  const nonAdminRoles = data.filter((role) => !role.isAdmin);

  function handleDelete(role: RoleData) {
    if (!window.confirm(t("deleteConfirm", { name: role.name }))) return;
    deleteRole.mutate(role.id, { onSuccess: () => toastSuccess(t("deleted")) });
  }

  return (
    <SettingsShell testId="roles-page">
      <SettingsBackLink label={t("backToSettings")} />
      <SettingsHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button onClick={() => setEditor({ role: null })}>
          <Plus size={16} aria-hidden="true" /> {t("newRole")}
          </Button>
        }
      />

      <SettingsSection>
        <Label htmlFor="default-role">{t("defaultRoleLabel")}</Label>
        <select
          id="default-role"
          value={
            data.find((role) => role.isDefault)?.id ?? ""
          }
          onChange={(event) => {
            setDefaultRole.mutate(event.target.value || null, {
              onSuccess: () => toastSuccess(t("defaultSaved")),
            });
          }}
          className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:w-72"
        >
          <option value="">{t("noDefault")}</option>
          {nonAdminRoles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-text-muted">{t("defaultRoleHint")}</p>
      </SettingsSection>

      <ul className="space-y-3" aria-label={t("listAria")}>
        {data.map((role) => (
          <li
            key={role.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-page-alt p-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-text-primary">{role.name}</p>
                {role.isAdmin && (
                  <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                    {t("adminBadge")}
                  </span>
                )}
                {role.isDefault && (
                  <span className="rounded bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary">
                    {t("defaultBadge")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {t("permissionCount", { count: role.permissions.length })} ·{" "}
                {t("userCount", { count: role.userCount })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!role.isAdmin && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditor({ role })}>
                    <Pencil size={14} aria-hidden="true" /> {t("edit")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(role)}>
                    <Trash2 size={14} aria-hidden="true" /> {t("delete")}
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editor && (
        <RoleEditor
          role={editor.role}
          saving={saving}
          onCancel={() => setEditor(null)}
          onSave={(name, permissions) => {
            setSaving(true);
            const onSuccess = () => {
              setSaving(false);
              setEditor(null);
              toastSuccess(t("saved"));
            };
            const onError = () => setSaving(false);
            if (editor.role) {
              updateRole.mutate({ id: editor.role.id, name, permissions }, { onSuccess, onError });
            } else {
              createRole.mutate({ name, permissions }, { onSuccess, onError });
            }
          }}
        />
      )}
    </SettingsShell>
  );
}

function RoleEditor({
  role,
  saving,
  onCancel,
  onSave,
}: {
  role: RoleData | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (name: string, permissions: string[]) => void;
}) {
  const t = useTranslations("roles.editor");
  const pt = useTranslations("roles.permissions");
  const [name, setName] = useState(role?.name ?? "");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);

  function toggle(permission: string) {
    setPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((item) => item !== permission)
        : [...prev, permission]
    );
  }

  function toggleModule(module: string, actions: readonly string[]) {
    const keys = actions.map((action) => `${module}.${action}`);
    const allSelected = keys.every((key) => permissions.includes(key));
    setPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        keys.forEach((key) => next.delete(key));
      } else {
        keys.forEach((key) => next.add(key));
      }
      return Array.from(next);
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), permissions);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
            <DialogTitle>{role ? t("titleEdit") : t("titleCreate")}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
          <Label htmlFor="role-name">{t("nameLabel")}</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
            required
          />
            </div>

            <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-text-primary">
            {t("permissionsTitle")}
          </legend>

          <div className="mt-3 space-y-4">
            {Object.entries(MODULES).map(([module, actions]) => {
              const allSelected = actions.every((action) =>
                permissions.includes(`${module}.${action}`)
              );
              return (
                <div key={module} className="rounded-lg border border-border bg-page p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text-primary">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleModule(module, actions)}
                      className="h-4 w-4 rounded border-border text-accent"
                    />
                    {pt(`modules.${module}`)}
                  </label>
                  <div className="mt-2 flex flex-wrap gap-3 pl-6">
                    {actions.map((action) => {
                      const key = `${module}.${action}`;
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-1.5 text-sm text-text-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={permissions.includes(key)}
                            onChange={() => toggle(key)}
                            className="h-4 w-4 rounded border-border text-accent"
                          />
                          {pt(`actions.${action}`)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="rounded-lg border border-border bg-page p-3">
              <p className="text-sm font-medium text-text-primary">
                {pt("specialSection")}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 pl-0 sm:pl-6">
                {SPECIAL_PERMISSIONS.map((permission) => (
                  <label
                    key={permission}
                    className="flex cursor-pointer items-center gap-1.5 text-sm text-text-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={permissions.includes(permission)}
                      onChange={() => toggle(permission)}
                      className="h-4 w-4 rounded border-border text-accent"
                    />
                    {pt(`special.${permission}`)}
                  </label>
                ))}
              </div>
            </div>
          </div>
            </fieldset>
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
