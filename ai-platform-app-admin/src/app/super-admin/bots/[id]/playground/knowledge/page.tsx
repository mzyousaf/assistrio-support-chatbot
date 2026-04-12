import { redirect } from "next/navigation";

export default async function PlaygroundKnowledgeIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/super-admin/bots/${id}/playground/knowledge/notes`);
}
