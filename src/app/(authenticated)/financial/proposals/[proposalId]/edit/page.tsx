"use client";

import { ProposalForm } from "@/components/financial/proposals/proposal-form";
import { useParams } from "next/navigation";

export default function EditProposalPage() {
  const params = useParams<{ proposalId: string }>();

  return <ProposalForm proposalId={params.proposalId} />;
}
