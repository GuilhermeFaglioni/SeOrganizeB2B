"use client";

import { ClientDetail } from "@/components/financial/clients/client-detail";
import { useParams } from "next/navigation";

export default function ClientDetailPage() {
  const params = useParams<{ clientId: string }>();

  return <ClientDetail clientId={params.clientId} />;
}
