"use client";

import { ContractDetail } from "@/components/financial/contracts/contract-detail";
import { useParams } from "next/navigation";

export default function ContractDetailPage() {
  const params = useParams<{ contractId: string }>();

  return <ContractDetail contractId={params.contractId} />;
}
