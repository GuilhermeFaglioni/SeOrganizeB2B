"use client";

import { ProposalDetail } from "@/components/financial/proposals/proposal-detail";

export default function ProposalDetailPage({
  params,
}: {
  params: { proposalId: string };
}) {
  return <ProposalDetail proposalId={params.proposalId} />;
}
