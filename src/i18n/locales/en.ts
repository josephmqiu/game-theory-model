const en = {
  // ── Common ──
  "common.connect": "Connect",
  "common.disconnect": "Disconnect",
  "common.best": "Best",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "New",
  "topbar.open": "Open",
  "topbar.save": "Save",
  "topbar.fullscreen": "Fullscreen",
  "topbar.exitFullscreen": "Exit fullscreen",
  "topbar.newAnalysis": "New Analysis",
  "topbar.unsavedFile": "Unsaved .gta file",
  "topbar.tooltipNew": "Start a fresh analysis",
  "topbar.tooltipOpen": "Open a saved .gta analysis",
  "topbar.tooltipSave": "Save the current analysis",
  "topbar.edited": "— Edited",
  "topbar.agentsAndMcp": "Agents & MCP",
  "topbar.setupAgentsMcp": "Setup Agents & MCP",
  "topbar.connected": "connected",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "Software Update",
  "updater.dismiss": "Dismiss",
  "updater.current": "Current",
  "updater.latest": "Latest",
  "updater.unknown": "Unknown",
  "updater.checking": "Checking...",
  "updater.downloadProgress": "Download Progress",
  "updater.checkAgain": "Check Again",
  "updater.restartInstall": "Restart & Install",
  "updater.installing": "Installing...",
  "updater.releaseDate": "Release date: {{date}}",
  "updater.restartHint":
    "Restart to apply update. Relaunch usually takes 10-15 seconds.",
  "updater.unknownError": "Unknown updater error.",
  "updater.title.checking": "Checking for updates",
  "updater.title.available": "Update found",
  "updater.title.downloading": "Downloading update",
  "updater.title.downloaded": "Ready to install",
  "updater.title.error": "Update failed",
  "updater.subtitle.checking": "Looking for the latest release...",
  "updater.subtitle.available": "Version {{version}} is available.",
  "updater.subtitle.availableGeneric": "A new version is available.",
  "updater.subtitle.downloading":
    "Version {{version}} is downloading in the background.",
  "updater.subtitle.downloadingGeneric":
    "Downloading update package in the background.",
  "updater.subtitle.downloaded": "Version {{version}} has been downloaded.",
  "updater.subtitle.downloadedGeneric": "The update has been downloaded.",
  "updater.subtitle.error": "Unable to check or download the update.",

  // ── Layers ──

  // ── Layer Context Menu ──

  // ── Property Panel ──

  // ── Fill ──

  // ── Image ──

  // ── Stroke ──

  // ── Appearance ──

  // ── Layout ──

  // ── Padding ──

  // ── Typography ──

  // ── Text Layout ──

  // ── Effects ──

  // ── Export ──

  // ── Polygon ──

  // ── Ellipse ──

  // ── Corner Radius ──

  // ── Size / Position ──

  // ── Icon ──

  // ── Variables Panel ──

  // ── AI Chat ──
  "ai.newChat": "New chat",
  "ai.collapse": "Collapse",
  "ai.generating": "Generating...",
  "ai.stopGenerating": "Stop generating",
  "ai.sendMessage": "Send message",
  "ai.loadingModels": "Loading models...",
  "ai.noModelsConnected": "No models connected",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "Setup Agents & MCP",
  "agents.agentsOnCanvas": "Agents on Canvas",
  "agents.mcpIntegrations": "MCP Integrations in Terminal",
  "agents.port": "Port",
  "agents.mcpRestart":
    "MCP integrations will take effect after restarting the terminal.",
  "agents.modelCount": "{{count}} model(s)",
  "agents.connectionFailed": "Connection failed",
  "agents.serverError": "Server error {{status}}",
  "agents.failedTo": "Failed to {{action}}",
  "agents.failedToMcp": "Failed to {{action}} MCP server",
  "agents.claudeModels": "Claude models",
  "agents.openaiModels": "OpenAI models",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ LLM providers",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "GitHub Copilot models",
  "agents.mcpServer": "MCP Server",
  "agents.mcpServerStop": "Stop",
  "agents.mcpServerRunning": "Running",
  "agents.mcpServerStopped": "Stopped",
  "agents.mcpClientConfig": "Client Config",
  "agents.autoUpdate": "Auto-check for updates",
  "agents.notInstalled": "Not installed",
  "agents.install": "Install",
  "agents.installing": "Installing...",
  "agents.installFailed": "Installation failed",
  "agents.viewDocs": "Docs",
  "agents.analysisRuntime": "Analysis Runtime",
  "agents.analysisWebSearch": "Web search",
  "agents.analysisWebSearchHint": "Use live web research during analysis runs.",
  "agents.analysisEffort": "Analysis effort",
  "agents.analysisEffortHint":
    "Controls analysis depth guidance for analysis runs, not model selection.",
  "agents.analysisEffortQuick": "Quick",
  "agents.analysisEffortStandard": "Standard",
  "agents.analysisEffortThorough": "Thorough",
  "agents.analysisPhases": "Phase selection",
  "agents.analysisPhasesHint":
    "Custom phase runs only the selected phases and may disable automatic downstream revalidation.",
  "agents.analysisPhasesAll": "All phases",
  "agents.analysisPhasesCustom": "Custom",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Page not found",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "Game Theory Analyst",
  "analysis.launcherHint":
    "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder":
    "What do you want to analyze?",
  "analysis.chatEmptyState":
    "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint":
    "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder":
    "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "Cannot change model while analysis is running. Stop the analysis first.",
  "analysis.unsavedChanges":
    "You have unsaved analysis changes. Discard them and start a new analysis?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "Preparing phase analysis.",
  "analysis.activity.researching": "Researching evidence.",
  "analysis.activity.synthesizing": "Synthesizing phase output.",
  "analysis.activity.validating": "Validating structured output.",
  "analysis.activity.retrying":
    "Retrying phase after validation or transport issue.",
  "analysis.activity.default": "Continuing phase analysis.",
  "analysis.activity.usingTool": "Using {{toolName}}",
  "analysis.activity.usingWebSearchQuery": "Using WebSearch: {{query}}",
  "analysis.activity.agentProgress": "Agent progress",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Phase {{number}} failed",
  "analysis.progress.phaseLabel": "Phase {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} phases complete",
  "analysis.progress.entityCount": "{{count}} entity",
  "analysis.progress.entityCountPlural": "{{count}} entities",
  "analysis.progress.cancelled": "Analysis cancelled",

  // ── Analysis Failures ──
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "timeout",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "provider error",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "Situational Grounding",
  "analysis.phases.playerIdentification": "Player Identification",
  "analysis.phases.baselineModel": "Baseline Model",
  "analysis.phases.historicalGame": "Historical Game",
  "analysis.phases.revalidation": "Revalidation",
  "analysis.phases.formalModeling": "Formal Modeling",
  "analysis.phases.assumptions": "Assumptions",
  "analysis.phases.elimination": "Elimination",
  "analysis.phases.scenarios": "Scenarios",
  "analysis.phases.metaCheck": "Meta-Check",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "Rerun phase",
  "analysis.sidebar.searchEntities": "Search entities...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "Fact",
  "analysis.entities.player": "Player",
  "analysis.entities.objective": "Objective",
  "analysis.entities.game": "Game",
  "analysis.entities.strategy": "Strategy",
  "analysis.entities.payoff": "Payoff",
  "analysis.entities.rule": "Rule",
  "analysis.entities.escalation": "Escalation",
  "analysis.entities.history": "History",
  "analysis.entities.pattern": "Pattern",
  "analysis.entities.trust": "Trust",
  "analysis.entities.commitment": "Commitment",
  "analysis.entities.signal": "Signal",
  "analysis.entities.matrix": "Matrix",
  "analysis.entities.gameTree": "Game Tree",
  "analysis.entities.equilibrium": "Equilibrium",
  "analysis.entities.constraints": "Constraints",
  "analysis.entities.crossGame": "Cross-Game",
  "analysis.entities.signalClass": "Signal Class",
  "analysis.entities.bargaining": "Bargaining",
  "analysis.entities.optionValue": "Option Value",
  "analysis.entities.behavioral": "Behavioral",
  "analysis.entities.assumption": "Assumption",
  "analysis.entities.eliminated": "Eliminated",
  "analysis.entities.scenario": "Scenario",
  "analysis.entities.thesis": "Thesis",
  "analysis.entities.metaCheck": "Meta-Check",
  "analysis.entities.confidence.high": "High",
  "analysis.entities.confidence.medium": "Medium",
  "analysis.entities.confidence.low": "Low",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "Human",
} as const;

export default en;
export type TranslationKeys = Partial<Record<keyof typeof en, string>> &
  Record<string, string>;
