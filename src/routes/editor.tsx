import { createFileRoute } from "@tanstack/react-router";
import EditorLayout from "@/components/editor/editor-layout";

export const Route = createFileRoute("/editor")({
  component: EditorPage,
  ssr: false,
  head: () => ({
    meta: [{ title: "Game Theory Analysis" }],
  }),
});

function EditorPage() {
  return <EditorLayout />;
}
