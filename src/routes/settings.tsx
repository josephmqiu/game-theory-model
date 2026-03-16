import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <p className="text-muted-foreground">
          Settings panel — AI provider configuration, model selection, and app
          preferences.
        </p>
      </div>
    </div>
  );
}
