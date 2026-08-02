"use client";

import { ClientDetail } from "@/components/financial/clients/client-detail";

export default function ClientDetailPage({
  params,
}: {
  params: { clientId: string };
}) {
  return <ClientDetail clientId={params.clientId} />;
}
