import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getProposalPublic } from "@/lib/financial/proposals-service";
import { isAppLocale } from "@/i18n/config";
import ptBR from "../../../../messages/pt-BR.json";
import en from "../../../../messages/en.json";
import {
  PublicProposalUnavailable,
  PublicProposalView,
  type PublicProposalData,
} from "@/components/financial/proposals/public-proposal";

const messages: Record<string, typeof ptBR> = {
  "pt-BR": ptBR,
  en,
};

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
    return <PublicProposalUnavailable />;
  }

  const locale = isAppLocale(proposal.locale) ? proposal.locale : "pt-BR";

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <PublicProposalView
        proposal={proposal as PublicProposalData}
        token={params.token}
      />
    </NextIntlClientProvider>
  );
}
