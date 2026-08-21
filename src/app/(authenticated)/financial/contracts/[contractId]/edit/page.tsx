"use client";

import { ContractForm } from "@/components/financial/contracts/contract-form";
import { useParams } from "next/navigation";

export default function EditContractPage() {
  const params = useParams<{ contractId: string }>();

  return <ContractForm contractId={params.contractId} />;
}
