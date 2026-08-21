"use client";

import { ClientForm } from "@/components/financial/clients/client-form";
import { useParams } from "next/navigation";

export default function EditClientPage() {
  const params = useParams<{ clientId: string }>();

  return <ClientForm clientId={params.clientId} />;
}
