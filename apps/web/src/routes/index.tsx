import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Target, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [{ title: "Game Theory Analysis" }],
  }),
});

function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Target size={40} className="text-primary" />
          <h1 className="text-5xl font-bold tracking-tight">
            {t("landing.title")}
            <span className="text-primary">{t("landing.titleAccent")}</span>
          </h1>
        </div>
        <p className="text-xl text-muted-foreground">{t("landing.tagline")}</p>
      </div>

      <div className="flex gap-4">
        <Link
          to="/editor"
          className="inline-flex items-center justify-center gap-2 h-10 rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          <Plus size={18} />
          {t("landing.openAnalysis")}
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        {t("landing.shortcutHint", { key1: "Ctrl", key2: "N" })}
      </p>
    </div>
  );
}
