"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  MODULES,
  SPECIAL_PERMISSIONS,
  type PermissionScope,
  type ScopedPermission,
} from "@/lib/authz/permissions";
import {
  buildScopedPermissions,
  findNameConflict,
  initialScopeMap,
  moduleHasAny,
  previewResources,
  SCOPE_OPTIONS,
  setPermissionScope,
  toggleModule,
  togglePermission,
  type ScopeMap,
} from "@/lib/authz/role-editor";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/shared/loading-state";
import {
  SettingsBackLink,
  SettingsHeader,
  SettingsSection,
  SettingsShell,
} from "@/components/settings/settings-shell";

const NO_DEFAULT_VALUE = "none";

interface EditorState {
  role: RoleData | null;
  readOnly: boolean;
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

  async function handleSave(
    name: string,
    permissions: ScopedPermission[]
  ): Promise<string | null> {
    if (!editor) return null;
    setSaving(true);
    try {
      if (editor.role) {
        await updateRole.mutateAsync({ id: editor.role.id, name, permissions });
      } else {
        await createRole.mutateAsync({ name, permissions });
      }
      setEditor(null);
      toastSuccess(t("saved"));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : null;
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsShell testId="roles-page">
      <SettingsBackLink label={t("backToSettings")} />
      <SettingsHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button onClick={() => setEditor({ role: null, readOnly: false })}>
            <Plus size={16} aria-hidden="true" /> {t("newRole")}
          </Button>
        }
      />

      <SettingsSection>
        <Label htmlFor="default-role">{t("defaultRoleLabel")}</Label>
        <Select
          value={data.find((role) => role.isDefault)?.id ?? NO_DEFAULT_VALUE}
          onValueChange={(value) => {
            setDefaultRole.mutate(value === NO_DEFAULT_VALUE ? null : value, {
              onSuccess: () => toastSuccess(t("defaultSaved")),
            });
          }}
        >
          <SelectTrigger id="default-role" className="mt-1 sm:w-72">
            <SelectValue placeholder={t("noDefault")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEFAULT_VALUE}>{t("noDefault")}</SelectItem>
            {nonAdminRoles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              {role.isAdmin ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditor({ role, readOnly: true })}
                >
                  {t("view")}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditor({ role, readOnly: false })}
                  >
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
          readOnly={editor.readOnly}
          saving={saving}
          existingNames={data
            .filter((role) => role.id !== editor.role?.id)
            .map((role) => role.name)}
          onCancel={() => setEditor(null)}
          onSave={handleSave}
        />
      )}
    </SettingsShell>
  );
}

function RoleEditor({
  role,
  readOnly,
  saving,
  existingNames,
  onCancel,
  onSave,
}: {
  role: RoleData | null;
  readOnly?: boolean;
  saving: boolean;
  existingNames: string[];
  onCancel: () => void;
  onSave: (name: string, permissions: ScopedPermission[]) => Promise<string | null>;
}) {
  const t = useTranslations("roles.editor");
  const pt = useTranslations("roles.permissions");
  const [name, setName] = useState(role?.name ?? "");
  const [scopeMap, setScopeMap] = useState<ScopeMap>(() =>
    initialScopeMap(role?.permissions ?? [])
  );
  const [error, setError] = useState<string | null>(null);

  const preview = previewResources(buildScopedPermissions(scopeMap));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (findNameConflict(name, existingNames)) {
      setError(t("nameExists"));
      return;
    }
    setError(null);
    void onSave(name.trim(), buildScopedPermissions(scopeMap)).then((message) => {
      if (message) setError(message);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
            <DialogTitle>
              {readOnly
                ? t("titleView")
                : role
                  ? t("titleEdit")
                  : t("titleCreate")}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {readOnly && (
              <p className="mb-4 rounded-lg bg-bg-secondary px-3 py-2 text-xs text-text-secondary">
                {t("adminLocked")}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="role-name">{t("nameLabel")}</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("namePlaceholder")}
                disabled={readOnly}
                required
              />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <fieldset>
                <legend className="text-sm font-semibold text-text-primary">
                  {t("permissionsTitle")}
                </legend>

                <div className="mt-3 space-y-4">
                  {Object.entries(MODULES).map(([module, actions]) => {
                    const anySelected = moduleHasAny(scopeMap, module, actions);
                    return (
                      <div
                        key={module}
                        className="rounded-lg border border-border bg-page p-3"
                      >
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text-primary">
                          <Checkbox
                            checked={anySelected}
                            disabled={readOnly}
                            onCheckedChange={() =>
                              setScopeMap((prev) => toggleModule(prev, module, actions))
                            }
                          />
                          {pt(`modules.${module}`)}
                        </label>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 pl-6">
                          {actions.map((action) => {
                            const key = `${module}.${action}`;
                            const enabled = key in scopeMap;
                            return (
                              <div
                                key={key}
                                className="flex items-center gap-2"
                              >
                                <label className="flex cursor-pointer items-center gap-1.5 text-sm text-text-secondary">
                                  <Checkbox
                                    checked={enabled}
                                    disabled={readOnly}
                                    onCheckedChange={() =>
                                      setScopeMap((prev) => togglePermission(prev, key))
                                    }
                                  />
                                  {pt(`actions.${action}`)}
                                </label>
                                {enabled && (
                                  <Select
                                    value={scopeMap[key]}
                                    disabled={readOnly}
                                    onValueChange={(value) =>
                                      setScopeMap((prev) =>
                                        setPermissionScope(
                                          prev,
                                          key,
                                          value as PermissionScope
                                        )
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      aria-label={`${key} ${t("scopeLabel")}`}
                                      className="h-7 w-24 text-xs"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SCOPE_OPTIONS.map((scope) => (
                                        <SelectItem key={scope} value={scope}>
                                          {t(`scope.${scope}`)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
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
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 pl-0 sm:pl-6">
                      {SPECIAL_PERMISSIONS.map((permission) => (
                        <label
                          key={permission}
                          className="flex cursor-pointer items-center gap-1.5 text-sm text-text-secondary"
                        >
                          <Checkbox
                            checked={permission in scopeMap}
                            disabled={readOnly}
                            onCheckedChange={() =>
                              setScopeMap((prev) => togglePermission(prev, permission))
                            }
                          />
                       {pt(`special.${permission}`)}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>

              <aside className="h-fit rounded-lg border border-border bg-page p-4 lg:sticky lg:top-0">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t("previewTitle")}
                </h3>
                <p className="mt-0.5 text-xs text-text-muted">{t("previewHint")}</p>
                <ul className="mt-3 space-y-1.5" aria-label={t("previewAria")}>
                  {preview.map((item) => (
                    <li
                      key={`${item.kind}-${item.resource}`}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-text-secondary">
                        {item.kind === "module"
                          ? pt(`modules.${item.resource}`)
                          : pt(`special.${item.resource}`)}
                      </span>
                      <Badge variant={scopeBadgeVariant(item.scope)}>
                        {t(`scope.${item.scope}`)}
                      </Badge>
                    </li>
                  ))}
                  {preview.length === 0 && (
                    <li className="text-xs text-text-muted">{t("previewEmpty")}</li>
                  )}
                </ul>
              </aside>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
            {error && (
              <p className="mr-auto max-w-xs text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <Button type="button" variant="outline" onClick={onCancel}>
              {readOnly ? t("close") : t("cancel")}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? t("saving") : t("save")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function scopeBadgeVariant(scope: PermissionScope) {
  if (scope === "all") return "success";
  if (scope === "area") return "secondary";
  return "outline";
}
