"use client";

import { ProposalForm } from "@/components/financial/proposals/proposal-form";

export default function EditProposalPage({
  params,
}: {
  params: { proposalId: string };
}) {
  return <ProposalForm proposalId={params.proposalId} />;
}
