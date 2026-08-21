"use client";

import { ProposalDetail } from "@/components/financial/proposals/proposal-detail";
import { useParams } from "next/navigation";

export default function ProposalDetailPage() {
  const params = useParams<{ proposalId: string }>();

  return <ProposalDetail proposalId={params.proposalId} />;
}
