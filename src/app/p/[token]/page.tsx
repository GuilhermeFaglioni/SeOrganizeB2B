import type { Metadata } from "next";
import { getProposalPublic } from "@/lib/financial/proposals-service";
import { isAppLocale } from "@/i18n/config";
import { PublicLocaleProvider } from "@/i18n/public-provider";
import {
  PublicProposalUnavailable,
  PublicProposalView,
  type PublicProposalData,
} from "@/components/financial/proposals/public-proposal";

export const metadata: Metadata = {
  title: "Proposta",
};

export const dynamic = "force-dynamic";

export default async function PublicProposalPage({
  params,
}: {
  params: { token: string };
}) {
  const proposal = await getProposalPublic(params.token);

  if (!proposal || proposal.status === "draft") {
    return (
      <PublicLocaleProvider locale="pt-BR">
        <PublicProposalUnavailable />
      </PublicLocaleProvider>
    );
  }

  const locale = isAppLocale(proposal.locale) ? proposal.locale : "pt-BR";

  return (
    <PublicLocaleProvider locale={locale}>
      <PublicProposalView
        proposal={proposal as PublicProposalData}
        token={params.token}
      />
    </PublicLocaleProvider>
  );
}
