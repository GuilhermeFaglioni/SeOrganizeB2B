"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCreateProposalTemplate,
  useProposalTemplates,
  useUpdateProposalTemplate,
} from "@/hooks/use-proposals";
import { TemplateEditor } from "@/components/financial/proposals/template-editor";
import { toastSuccess } from "@/lib/toast";
import { LoadingState } from "@/components/shared/loading-state";

export function TemplateEditorScreen({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const t = useTranslations("proposals.templates");
  const { data: templates } = useProposalTemplates();
  const createTemplate = useCreateProposalTemplate();
  const updateTemplate = useUpdateProposalTemplate();

  const existing = templateId
    ? templates?.find((template) => template.id === templateId)
    : undefined;

  if (templateId && !existing) return <LoadingState />;

  const saving = createTemplate.isPending || updateTemplate.isPending;

  function handleSubmit(name: string, html: string) {
    const onSuccess = () => {
      toastSuccess(t("saved"));
      router.push("/financial/proposals/templates");
    };
    if (templateId && existing) {
      updateTemplate.mutate({ id: templateId, name, html }, { onSuccess });
    } else {
      createTemplate.mutate({ name, html }, { onSuccess });
    }
  }

  return (
    <TemplateEditor
      initialName={existing?.name ?? ""}
      initialHtml={existing?.html ?? ""}
      saving={saving}
      submitLabel={templateId ? t("saveTemplate") : t("createTemplate")}
      onSubmit={handleSubmit}
    />
  );
}
