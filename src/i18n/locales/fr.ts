import type { TranslationKeys } from "./en";

const fr: TranslationKeys = {
  // ── Common ──
  "common.connect": "Connecter",
  "common.disconnect": "Déconnecter",
  "common.best": "Recommandé",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "Nouveau",
  "topbar.open": "Ouvrir",
  "topbar.save": "Enregistrer",
  "topbar.fullscreen": "Plein écran",
  "topbar.exitFullscreen": "Quitter le plein écran",
  "topbar.newAnalysis": "Nouvelle analyse",
  "topbar.unsavedFile": "Fichier .gta non enregistr\u00e9",
  "topbar.tooltipNew": "D\u00e9marrer une nouvelle analyse",
  "topbar.tooltipOpen": "Ouvrir une analyse .gta enregistr\u00e9e",
  "topbar.tooltipSave": "Enregistrer l\u2019analyse en cours",
  "topbar.edited": "— Modifié",
  "topbar.agentsAndMcp": "Agents & MCP",
  "topbar.setupAgentsMcp": "Configurer Agents & MCP",
  "topbar.connected": "connecté",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "Mise à jour logicielle",
  "updater.dismiss": "Ignorer",
  "updater.current": "Actuelle",
  "updater.latest": "Dernière",
  "updater.unknown": "Inconnue",
  "updater.checking": "Vérification...",
  "updater.downloadProgress": "Progression du téléchargement",
  "updater.checkAgain": "Vérifier à nouveau",
  "updater.restartInstall": "Redémarrer et installer",
  "updater.installing": "Installation...",
  "updater.releaseDate": "Date de publication : {{date}}",
  "updater.restartHint":
    "Redémarrez pour appliquer la mise à jour. Le redémarrage prend généralement 10 à 15 secondes.",
  "updater.unknownError": "Erreur de mise à jour inconnue.",
  "updater.title.checking": "Recherche de mises à jour",
  "updater.title.available": "Mise à jour disponible",
  "updater.title.downloading": "Téléchargement de la mise à jour",
  "updater.title.downloaded": "Prêt à installer",
  "updater.title.error": "Échec de la mise à jour",
  "updater.subtitle.checking": "Recherche de la dernière version...",
  "updater.subtitle.available": "La version {{version}} est disponible.",
  "updater.subtitle.availableGeneric": "Une nouvelle version est disponible.",
  "updater.subtitle.downloading":
    "La version {{version}} est en cours de téléchargement en arrière-plan.",
  "updater.subtitle.downloadingGeneric":
    "Téléchargement du paquet de mise à jour en arrière-plan.",
  "updater.subtitle.downloaded": "La version {{version}} a été téléchargée.",
  "updater.subtitle.downloadedGeneric": "La mise à jour a été téléchargée.",
  "updater.subtitle.error":
    "Impossible de vérifier ou de télécharger la mise à jour.",

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
  "ai.newChat": "Nouvelle conversation",
  "ai.collapse": "Réduire",
  "ai.generating": "Génération...",
  "ai.stopGenerating": "Arrêter la génération",
  "ai.sendMessage": "Envoyer le message",
  "ai.loadingModels": "Chargement des modèles...",
  "ai.noModelsConnected": "Aucun modèle connecté",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "Configurer Agents & MCP",
  "agents.agentsOnCanvas": "Agents sur le canevas",
  "agents.mcpIntegrations": "Intégrations MCP dans le terminal",
  "agents.port": "Port",
  "agents.mcpRestart":
    "Les intégrations MCP prendront effet après le redémarrage du terminal.",
  "agents.modelCount": "{{count}} modèle(s)",
  "agents.connectionFailed": "Échec de la connexion",
  "agents.serverError": "Erreur serveur {{status}}",
  "agents.failedTo": "Échec de {{action}}",
  "agents.failedToMcp": "Échec de {{action}} du serveur MCP",
  "agents.claudeModels": "Modèles Claude",
  "agents.openaiModels": "Modèles OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ fournisseurs LLM",
  "agents.mcpServer": "Serveur MCP",
  "agents.mcpServerStop": "Arrêter",
  "agents.mcpServerRunning": "En cours",
  "agents.mcpServerStopped": "Arrêté",
  "agents.mcpClientConfig": "Config. client",
  "agents.autoUpdate": "Vérifier les mises à jour automatiquement",
  "agents.notInstalled": "Non installé",
  "agents.install": "Installer",
  "agents.installing": "Installation...",
  "agents.installFailed": "Échec de l'installation",
  "agents.viewDocs": "Docs",
  "agents.analysisRuntime": "Moteur d\u2019analyse",
  "agents.analysisWebSearch": "Recherche web",
  "agents.analysisWebSearchHint":
    "Utiliser la recherche web en direct pendant les analyses.",
  "agents.analysisEffort": "Effort d\u2019analyse",
  "agents.analysisEffortHint":
    "Contr\u00f4le la profondeur d\u2019analyse, pas la s\u00e9lection du mod\u00e8le.",
  "agents.analysisEffortQuick": "Rapide",
  "agents.analysisEffortStandard": "Standard",
  "agents.analysisEffortThorough": "Approfondi",
  "agents.analysisPhases": "S\u00e9lection des phases",
  "agents.analysisPhasesHint":
    "L\u2019ex\u00e9cution personnalis\u00e9e ne lance que les phases s\u00e9lectionn\u00e9es et peut d\u00e9sactiver la revalidation automatique en aval.",
  "agents.analysisPhasesAll": "Toutes les phases",
  "agents.analysisPhasesCustom": "Personnalis\u00e9",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Page introuvable",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "Analyste en théorie des jeux",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "Impossible de changer de modèle pendant une analyse. Arrêtez d\u2019abord l\u2019analyse.",
  "analysis.unsavedChanges":
    "Vous avez des modifications d\u2019analyse non enregistrées. Les abandonner et commencer une nouvelle analyse ?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "Préparation de l\u2019analyse de phase.",
  "analysis.activity.researching": "Recherche de preuves.",
  "analysis.activity.synthesizing": "Synthèse de la sortie de phase.",
  "analysis.activity.validating": "Validation de la sortie structurée.",
  "analysis.activity.retrying":
    "Nouvelle tentative de phase après un problème de validation ou de transport.",
  "analysis.activity.default": "Poursuite de l\u2019analyse de phase.",
  "analysis.activity.usingTool": "Utilisation de {{toolName}}",
  "analysis.activity.usingWebSearchQuery":
    "Utilisation de WebSearch : {{query}}",
  "analysis.activity.agentProgress": "Progression de l\u2019agent",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Phase {{number}} échouée",
  "analysis.progress.phaseLabel": "Phase {{number}} : {{name}}",
  "analysis.progress.phasesComplete":
    "{{completed}}/{{total}} phases terminées",
  "analysis.progress.entityCount": "{{count}} entité",
  "analysis.progress.entityCountPlural": "{{count}} entités",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "délai dépassé",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "erreur du fournisseur",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "Ancrage situationnel",
  "analysis.phases.playerIdentification": "Identification des joueurs",
  "analysis.phases.baselineModel": "Modèle de référence",
  "analysis.phases.historicalGame": "Jeu historique",
  "analysis.phases.revalidation": "Revalidation",
  "analysis.phases.formalModeling": "Modélisation formelle",
  "analysis.phases.assumptions": "Hypothèses",
  "analysis.phases.elimination": "Élimination",
  "analysis.phases.scenarios": "Scénarios",
  "analysis.phases.metaCheck": "Méta-vérification",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "Relancer la phase",
  "analysis.sidebar.searchEntities": "Rechercher des entités...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "Fait",
  "analysis.entities.player": "Joueur",
  "analysis.entities.objective": "Objectif",
  "analysis.entities.game": "Jeu",
  "analysis.entities.strategy": "Stratégie",
  "analysis.entities.payoff": "Gain",
  "analysis.entities.rule": "Règle",
  "analysis.entities.escalation": "Escalade",
  "analysis.entities.history": "Historique",
  "analysis.entities.pattern": "Motif",
  "analysis.entities.trust": "Confiance",
  "analysis.entities.commitment": "Engagement",
  "analysis.entities.signal": "Signal",
  "analysis.entities.matrix": "Matrice",
  "analysis.entities.gameTree": "Arbre de jeu",
  "analysis.entities.equilibrium": "Équilibre",
  "analysis.entities.constraints": "Contraintes",
  "analysis.entities.crossGame": "Inter-jeux",
  "analysis.entities.signalClass": "Classe de signal",
  "analysis.entities.bargaining": "Négociation",
  "analysis.entities.optionValue": "Valeur d\u2019option",
  "analysis.entities.behavioral": "Comportemental",
  "analysis.entities.assumption": "Hypothèse",
  "analysis.entities.eliminated": "Éliminé",
  "analysis.entities.scenario": "Scénario",
  "analysis.entities.thesis": "Thèse",
  "analysis.entities.metaCheck": "Méta-vérification",
  "analysis.entities.confidence.high": "Élevée",
  "analysis.entities.confidence.medium": "Moyenne",
  "analysis.entities.confidence.low": "Faible",
  "analysis.entities.source.ai": "IA",
  "analysis.entities.source.human": "Humain",
} as const;

export default fr;
