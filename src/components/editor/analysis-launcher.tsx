import { useState } from "react";
import { Loader2, Search, CornerDownLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAIStore } from "@/stores/ai-store";

const EXAMPLE_TOPICS = [
  "US-China semiconductor export controls",
  "OpenAI vs Anthropic coding agent competition",
  "NBA free agency and salary cap strategies",
];

interface AnalysisLauncherProps {
  onStartAnalysis: (topic: string, provider?: string, model?: string) => void;
}

export default function AnalysisLauncher({
  onStartAnalysis,
}: AnalysisLauncherProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const model = useAIStore((s) => s.model);
  const availableModels = useAIStore((s) => s.availableModels);
  const modelGroups = useAIStore((s) => s.modelGroups);
  const isLoadingModels = useAIStore((s) => s.isLoadingModels);

  const noAvailableModels = !isLoadingModels && availableModels.length === 0;
  const canUseModel = !isLoadingModels && availableModels.length > 0;
  const currentModelLabel =
    availableModels.find((candidate) => candidate.value === model)
      ?.displayName ?? model;

  const submitTopic = (rawTopic: string) => {
    const topic = rawTopic.trim();
    if (!topic || !canUseModel) return;

    const currentProvider = modelGroups.find((group) =>
      group.models.some((candidate) => candidate.value === model),
    )?.provider;

    setInput("");
    onStartAnalysis(topic, currentProvider, model);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
      {/* Question */}
      <p className="mb-4 font-[Geist,sans-serif] text-[13px] font-medium text-zinc-500">
        {t("analysis.launcherInputPlaceholder")}
      </p>

      {/* Input */}
      <div className="flex w-full max-w-[480px] items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2">
        {isLoadingModels ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-zinc-500" />
        ) : (
          <Search size={14} className="shrink-0 text-zinc-500" />
        )}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitTopic(input);
            }
          }}
          placeholder={t("analysis.launcherHint")}
          className="h-8 flex-1 bg-transparent font-[Geist,sans-serif] text-[13px] font-medium text-zinc-200 placeholder:text-zinc-600 outline-none"
        />
        {input.trim().length > 0 && canUseModel && (
          <CornerDownLeft size={13} className="shrink-0 text-zinc-500" />
        )}
      </div>

      {/* Example pills */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {EXAMPLE_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => submitTopic(topic)}
            disabled={!canUseModel}
            className={cn(
              "rounded-full border border-zinc-700 px-3 py-1 font-[Geist,sans-serif] text-[11px] font-medium text-zinc-500 transition-colors",
              canUseModel
                ? "hover:border-zinc-600 hover:text-zinc-300"
                : "cursor-default opacity-50",
            )}
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Model indicator */}
      <p className="mt-5 font-[Geist,sans-serif] text-[11px] text-zinc-600">
        {isLoadingModels
          ? t("ai.loadingModels")
          : noAvailableModels
            ? t("ai.noModelsConnected")
            : currentModelLabel}
      </p>
    </div>
  );
}
