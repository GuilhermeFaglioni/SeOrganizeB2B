"use client";

import { useSearchParams } from "next/navigation";
import { ProposalForm } from "@/components/financial/proposals/proposal-form";

export default function NewProposalPage() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId") ?? undefined;
  return <ProposalForm initialTemplateId={templateId} />;
}
