"use client";

import { ContractDetail } from "@/components/financial/contracts/contract-detail";

export default function ContractDetailPage({
  params,
}: {
  params: { contractId: string };
}) {
  return <ContractDetail contractId={params.contractId} />;
}
