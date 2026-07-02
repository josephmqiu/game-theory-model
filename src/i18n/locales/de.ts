import type { TranslationKeys } from "./en";

const de: TranslationKeys = {
  // ── Common ──
  "common.connect": "Verbinden",
  "common.disconnect": "Trennen",
  "common.best": "Beste",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "Neu",
  "topbar.open": "Öffnen",
  "topbar.save": "Speichern",
  "topbar.fullscreen": "Vollbild",
  "topbar.exitFullscreen": "Vollbild beenden",
  "topbar.newAnalysis": "Neue Analyse",
  "topbar.unsavedFile": "Ungespeicherte .gta-Datei",
  "topbar.tooltipNew": "Eine neue Analyse starten",
  "topbar.tooltipOpen": "Eine gespeicherte .gta-Analyse \u00f6ffnen",
  "topbar.tooltipSave": "Die aktuelle Analyse speichern",
  "topbar.edited": "— Bearbeitet",
  "topbar.agentsAndMcp": "Agenten & MCP",
  "topbar.setupAgentsMcp": "Agenten & MCP einrichten",
  "topbar.connected": "verbunden",

  // ── Right Panel ──


  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "Software-Update",
  "updater.dismiss": "Schließen",
  "updater.current": "Aktuell",
  "updater.latest": "Neueste",
  "updater.unknown": "Unbekannt",
  "updater.checking": "Prüfe...",
  "updater.downloadProgress": "Downloadfortschritt",
  "updater.checkAgain": "Erneut prüfen",
  "updater.restartInstall": "Neustart & Installieren",
  "updater.installing": "Installiere...",
  "updater.releaseDate": "Veröffentlichungsdatum: {{date}}",
  "updater.restartHint":
    "Neustart zum Anwenden des Updates. Der Neustart dauert in der Regel 10–15 Sekunden.",
  "updater.unknownError": "Unbekannter Updater-Fehler.",
  "updater.title.checking": "Suche nach Updates",
  "updater.title.available": "Update gefunden",
  "updater.title.downloading": "Update wird heruntergeladen",
  "updater.title.downloaded": "Bereit zur Installation",
  "updater.title.error": "Update fehlgeschlagen",
  "updater.subtitle.checking": "Suche nach der neuesten Version...",
  "updater.subtitle.available": "Version {{version}} ist verfügbar.",
  "updater.subtitle.availableGeneric": "Eine neue Version ist verfügbar.",
  "updater.subtitle.downloading":
    "Version {{version}} wird im Hintergrund heruntergeladen.",
  "updater.subtitle.downloadingGeneric":
    "Update-Paket wird im Hintergrund heruntergeladen.",
  "updater.subtitle.downloaded": "Version {{version}} wurde heruntergeladen.",
  "updater.subtitle.downloadedGeneric": "Das Update wurde heruntergeladen.",
  "updater.subtitle.error":
    "Das Update konnte nicht geprüft oder heruntergeladen werden.",

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
  "ai.newChat": "Neuer Chat",
  "ai.collapse": "Einklappen",
  "ai.generating": "Generiere...",
  "ai.stopGenerating": "Generierung stoppen",
  "ai.sendMessage": "Nachricht senden",
  "ai.loadingModels": "Modelle werden geladen...",
  "ai.noModelsConnected": "Keine Modelle verbunden",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "Agenten & MCP einrichten",
  "agents.agentsOnCanvas": "Agenten auf der Arbeitsfläche",
  "agents.mcpIntegrations": "MCP-Integrationen im Terminal",
  "agents.port": "Port",
  "agents.mcpRestart":
    "MCP-Integrationen werden nach einem Neustart des Terminals wirksam.",
  "agents.modelCount": "{{count}} Modell(e)",
  "agents.connectionFailed": "Verbindung fehlgeschlagen",
  "agents.serverError": "Serverfehler {{status}}",
  "agents.failedTo": "{{action}} fehlgeschlagen",
  "agents.failedToMcp": "MCP-Server {{action}} fehlgeschlagen",
  "agents.claudeModels": "Claude-Modelle",
  "agents.openaiModels": "OpenAI-Modelle",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ LLM-Anbieter",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "GitHub Copilot-Modelle",
  "agents.mcpServer": "MCP-Server",
  "agents.mcpServerStop": "Stoppen",
  "agents.mcpServerRunning": "Läuft",
  "agents.mcpServerStopped": "Gestoppt",
  "agents.mcpClientConfig": "Client-Konfiguration",
  "agents.autoUpdate": "Automatisch nach Updates suchen",
  "agents.notInstalled": "Nicht installiert",
  "agents.install": "Installieren",
  "agents.installing": "Installiere...",
  "agents.installFailed": "Installation fehlgeschlagen",
  "agents.viewDocs": "Doku",
  "agents.analysisRuntime": "Analyse-Laufzeit",
  "agents.analysisWebSearch": "Websuche",
  "agents.analysisWebSearchHint":
    "Live-Webrecherche w\u00e4hrend der Analyse verwenden.",
  "agents.analysisEffort": "Analyseaufwand",
  "agents.analysisEffortHint":
    "Steuert die Analysetiefe, nicht die Modellauswahl.",
  "agents.analysisEffortQuick": "Schnell",
  "agents.analysisEffortStandard": "Standard",
  "agents.analysisEffortThorough": "Gr\u00fcndlich",
  "agents.analysisPhases": "Phasenauswahl",
  "agents.analysisPhasesHint":
    "Benutzerdefinierte Ausf\u00fchrung startet nur die ausgew\u00e4hlten Phasen und kann die automatische nachgelagerte Revalidierung deaktivieren.",
  "agents.analysisPhasesAll": "Alle Phasen",
  "agents.analysisPhasesCustom": "Benutzerdefiniert",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Seite nicht gefunden",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "Spieltheorie-Analyst",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "Das Modell kann nicht gewechselt werden, während die Analyse läuft. Stoppen Sie zuerst die Analyse.",
  "analysis.unsavedChanges":
    "Sie haben ungespeicherte Analyseänderungen. Verwerfen und eine neue Analyse starten?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "Phasenanalyse wird vorbereitet.",
  "analysis.activity.researching": "Evidenz wird recherchiert.",
  "analysis.activity.synthesizing": "Phasenergebnis wird synthetisiert.",
  "analysis.activity.validating": "Strukturierte Ausgabe wird validiert.",
  "analysis.activity.retrying":
    "Phase wird nach Validierungs- oder Transportfehler wiederholt.",
  "analysis.activity.default": "Phasenanalyse wird fortgesetzt.",
  "analysis.activity.usingTool": "Verwende {{toolName}}",
  "analysis.activity.usingWebSearchQuery":
    "Verwende WebSearch: {{query}}",
  "analysis.activity.agentProgress": "Agentenfortschritt",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Phase {{number}} fehlgeschlagen",
  "analysis.progress.phaseLabel": "Phase {{number}}: {{name}}",
  "analysis.progress.phasesComplete":
    "{{completed}}/{{total}} Phasen abgeschlossen",
  "analysis.progress.entityCount": "{{count}} Entität",
  "analysis.progress.entityCountPlural": "{{count}} Entitäten",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "Zeitüberschreitung",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "Anbieterfehler",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "Situative Einordnung",
  "analysis.phases.playerIdentification": "Spieleridentifikation",
  "analysis.phases.baselineModel": "Basismodell",
  "analysis.phases.historicalGame": "Historisches Spiel",
  "analysis.phases.revalidation": "Revalidierung",
  "analysis.phases.formalModeling": "Formale Modellierung",
  "analysis.phases.assumptions": "Annahmen",
  "analysis.phases.elimination": "Elimination",
  "analysis.phases.scenarios": "Szenarien",
  "analysis.phases.metaCheck": "Meta-Prüfung",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "Phase erneut ausführen",
  "analysis.sidebar.searchEntities": "Entitäten suchen...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "Fakt",
  "analysis.entities.player": "Spieler",
  "analysis.entities.objective": "Ziel",
  "analysis.entities.game": "Spiel",
  "analysis.entities.strategy": "Strategie",
  "analysis.entities.payoff": "Auszahlung",
  "analysis.entities.rule": "Regel",
  "analysis.entities.escalation": "Eskalation",
  "analysis.entities.history": "Verlauf",
  "analysis.entities.pattern": "Muster",
  "analysis.entities.trust": "Vertrauen",
  "analysis.entities.commitment": "Verpflichtung",
  "analysis.entities.signal": "Signal",
  "analysis.entities.matrix": "Matrix",
  "analysis.entities.gameTree": "Spielbaum",
  "analysis.entities.equilibrium": "Gleichgewicht",
  "analysis.entities.constraints": "Beschränkungen",
  "analysis.entities.crossGame": "Spielübergreifend",
  "analysis.entities.signalClass": "Signalklasse",
  "analysis.entities.bargaining": "Verhandlung",
  "analysis.entities.optionValue": "Optionswert",
  "analysis.entities.behavioral": "Verhaltensbasiert",
  "analysis.entities.assumption": "Annahme",
  "analysis.entities.eliminated": "Eliminiert",
  "analysis.entities.scenario": "Szenario",
  "analysis.entities.thesis": "These",
  "analysis.entities.metaCheck": "Meta-Prüfung",
  "analysis.entities.confidence.high": "Hoch",
  "analysis.entities.confidence.medium": "Mittel",
  "analysis.entities.confidence.low": "Niedrig",
  "analysis.entities.source.ai": "KI",
  "analysis.entities.source.human": "Mensch",
} as const;

export default de;
