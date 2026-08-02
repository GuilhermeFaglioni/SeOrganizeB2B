"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateClient, useUpdateClient, useClient } from "@/hooks/use-clients";
import { toastSuccess, toastError } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";

export function ClientForm({ clientId }: { clientId?: string }) {
  const router = useRouter();
  const t = useTranslations("financial.clients.form");
  const { data: existing, isLoading: loadingExisting } = useClient(clientId ?? "");
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const hydratedId = useRef<string | null>(null);

  useEffect(() => {
    if (!existing || !clientId || hydratedId.current === existing.id) return;
    hydratedId.current = existing.id;
    setName(existing.name ?? "");
    setLegalName(existing.legalName ?? "");
    setCpfCnpj(existing.cpfCnpj ?? "");
    setEmail(existing.email ?? "");
    setPhone(existing.phone ?? "");
    setNotes(existing.notes ?? "");
  }, [existing, clientId]);

  if (clientId && loadingExisting) return <LoadingState />;

  function submit() {
    const payload = {
      name: name.trim(),
      legalName: legalName || undefined,
      cpfCnpj: cpfCnpj || undefined,
      email: email || undefined,
      phone: phone || undefined,
      notes: notes || undefined,
    };

    if (clientId) {
      updateClient.mutate(
        { id: clientId, ...payload },
        {
          onSuccess: () => {
            toastSuccess(t("updatedSuccess"));
            router.push(`/financial/clients/${clientId}`);
          },
          onError: (error: Error) => {
            if (error.message?.includes("already in use")) {
              toastError(t("conflictTitle"), t("conflictMessage"));
            }
          },
        }
      );
      return;
    }

    createClient.mutate(payload, {
      onSuccess: (client) => {
        toastSuccess(t("createdSuccess"));
        router.push(`/financial/clients/${(client as { id: string }).id}`);
      },
      onError: (error: Error) => {
        if (error.message?.includes("already in use")) {
          toastError(t("conflictTitle"), t("conflictMessage"));
        }
      },
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="space-y-4 rounded-xl border border-border bg-page-alt p-4">
        <div>
          <Label htmlFor="client-name">{t("name")} *</Label>
          <Input
            id="client-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="client-legal">{t("legalName")}</Label>
          <Input
            id="client-legal"
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="client-doc">{t("cpfCnpj")}</Label>
          <Input
            id="client-doc"
            value={cpfCnpj}
            onChange={(event) => setCpfCnpj(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="client-email">{t("email")}</Label>
          <Input
            id="client-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="client-phone">{t("phone")}</Label>
          <Input
            id="client-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="client-notes">{t("notes")}</Label>
          <textarea
            id="client-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          />
        </div>
      </div>
      <Button disabled={!name.trim() || createClient.isPending || updateClient.isPending} onClick={submit}>
        {clientId ? t("saveChanges") : t("createClient")}
      </Button>
    </div>
  );
}
