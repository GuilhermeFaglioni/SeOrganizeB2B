"use client";

import { TemplateEditorScreen } from "@/components/financial/proposals/template-editor-screen";
import { useParams } from "next/navigation";

export default function EditTemplatePage() {
  const params = useParams<{ templateId: string }>();

  return <TemplateEditorScreen templateId={params.templateId} />;
}
