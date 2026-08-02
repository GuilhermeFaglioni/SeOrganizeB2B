"use client";

import { ContractForm } from "@/components/financial/contracts/contract-form";

export default function EditContractPage({
  params,
}: {
  params: { contractId: string };
}) {
  return <ContractForm contractId={params.contractId} />;
}
