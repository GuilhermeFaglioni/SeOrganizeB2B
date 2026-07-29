import { redirect } from "next/navigation";
import { prisma } from "../../../prisma/client";

export default async function AuthenticatedHome() {
  const project = await prisma.project.findFirst({
    select: { id: true },
    where: { archived: false },
  });

  if (project) {
    redirect(`/board/${project.id}`);
  }

  redirect("/projects");
}
