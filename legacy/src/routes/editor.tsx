import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/shell/app-layout";

export const Route = createFileRoute("/editor")({
  component: EditorLayout,
  ssr: false,
  head: () => ({
    meta: [{ title: "Editor — Game Theory Analyzer" }],
  }),
});

function EditorLayout() {
  return <AppLayout />;
}
