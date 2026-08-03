"use client";

import { TemplateEditorScreen } from "@/components/financial/proposals/template-editor-screen";

export default function EditTemplatePage({
  params,
}: {
  params: { templateId: string };
}) {
  return <TemplateEditorScreen templateId={params.templateId} />;
}
