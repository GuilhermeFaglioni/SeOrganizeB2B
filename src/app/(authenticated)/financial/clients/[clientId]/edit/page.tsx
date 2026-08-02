"use client";

import { ClientForm } from "@/components/financial/clients/client-form";

export default function EditClientPage({
  params,
}: {
  params: { clientId: string };
}) {
  return <ClientForm clientId={params.clientId} />;
}
