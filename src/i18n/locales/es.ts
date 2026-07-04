import type { TranslationKeys } from "./en";

const es: TranslationKeys = {
  // ── Common ──
  "common.connect": "Conectar",
  "common.disconnect": "Desconectar",
  "common.best": "Recomendado",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "Nuevo",
  "topbar.open": "Abrir",
  "topbar.save": "Guardar",
  "topbar.fullscreen": "Pantalla completa",
  "topbar.exitFullscreen": "Salir de pantalla completa",
  "topbar.newAnalysis": "Nuevo an\u00e1lisis",
  "topbar.unsavedFile": "Archivo .gta sin guardar",
  "topbar.tooltipNew": "Iniciar un nuevo an\u00e1lisis",
  "topbar.tooltipOpen": "Abrir un an\u00e1lisis .gta guardado",
  "topbar.tooltipSave": "Guardar el an\u00e1lisis actual",
  "topbar.edited": "— Editado",
  "topbar.agentsAndMcp": "Agentes y MCP",
  "topbar.setupAgentsMcp": "Configurar Agentes y MCP",
  "topbar.connected": "conectado",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "Actualización de software",
  "updater.dismiss": "Descartar",
  "updater.current": "Actual",
  "updater.latest": "Última",
  "updater.unknown": "Desconocida",
  "updater.checking": "Comprobando...",
  "updater.downloadProgress": "Progreso de descarga",
  "updater.checkAgain": "Comprobar de nuevo",
  "updater.restartInstall": "Reiniciar e instalar",
  "updater.installing": "Instalando...",
  "updater.releaseDate": "Fecha de publicación: {{date}}",
  "updater.restartHint":
    "Reinicie para aplicar la actualización. El reinicio suele tardar entre 10 y 15 segundos.",
  "updater.unknownError": "Error de actualización desconocido.",
  "updater.title.checking": "Buscando actualizaciones",
  "updater.title.available": "Actualización encontrada",
  "updater.title.downloading": "Descargando actualización",
  "updater.title.downloaded": "Listo para instalar",
  "updater.title.error": "Error de actualización",
  "updater.subtitle.checking": "Buscando la última versión...",
  "updater.subtitle.available": "La versión {{version}} está disponible.",
  "updater.subtitle.availableGeneric": "Hay una nueva versión disponible.",
  "updater.subtitle.downloading":
    "La versión {{version}} se está descargando en segundo plano.",
  "updater.subtitle.downloadingGeneric":
    "Descargando el paquete de actualización en segundo plano.",
  "updater.subtitle.downloaded": "La versión {{version}} se ha descargado.",
  "updater.subtitle.downloadedGeneric": "La actualización se ha descargado.",
  "updater.subtitle.error":
    "No se pudo comprobar o descargar la actualización.",

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
  "ai.newChat": "Nueva conversación",
  "ai.collapse": "Contraer",
  "ai.generating": "Generando...",
  "ai.stopGenerating": "Detener generación",
  "ai.sendMessage": "Enviar mensaje",
  "ai.loadingModels": "Cargando modelos...",
  "ai.noModelsConnected": "Sin modelos conectados",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "Configurar Agentes y MCP",
  "agents.agentsOnCanvas": "Agentes en el lienzo",
  "agents.mcpIntegrations": "Integraciones MCP en terminal",
  "agents.port": "Puerto",
  "agents.mcpRestart":
    "Las integraciones MCP se aplicarán tras reiniciar la terminal.",
  "agents.modelCount": "{{count}} modelo(s)",
  "agents.connectionFailed": "Error de conexión",
  "agents.serverError": "Error del servidor {{status}}",
  "agents.failedTo": "Error al {{action}}",
  "agents.failedToMcp": "Error al {{action}} del servidor MCP",
  "agents.claudeModels": "Modelos Claude",
  "agents.openaiModels": "Modelos OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ proveedores LLM",
  "agents.mcpServer": "Servidor MCP",
  "agents.mcpServerStop": "Detener",
  "agents.mcpServerRunning": "En ejecución",
  "agents.mcpServerStopped": "Detenido",
  "agents.mcpClientConfig": "Config. del cliente",
  "agents.autoUpdate": "Buscar actualizaciones automáticamente",
  "agents.notInstalled": "No instalado",
  "agents.install": "Instalar",
  "agents.installing": "Instalando...",
  "agents.installFailed": "Instalación fallida",
  "agents.viewDocs": "Docs",
  "agents.analysisRuntime": "Motor de an\u00e1lisis",
  "agents.analysisWebSearch": "B\u00fasqueda web",
  "agents.analysisWebSearchHint":
    "Usar investigaci\u00f3n web en vivo durante los an\u00e1lisis.",
  "agents.analysisEffort": "Esfuerzo de an\u00e1lisis",
  "agents.analysisEffortHint":
    "Controla la profundidad del an\u00e1lisis, no la selecci\u00f3n de modelo.",
  "agents.analysisEffortQuick": "R\u00e1pido",
  "agents.analysisEffortStandard": "Est\u00e1ndar",
  "agents.analysisEffortThorough": "Exhaustivo",
  "agents.analysisPhases": "Selecci\u00f3n de fases",
  "agents.analysisPhasesHint":
    "La ejecuci\u00f3n personalizada solo ejecuta las fases seleccionadas y puede desactivar la revalidaci\u00f3n autom\u00e1tica posterior.",
  "agents.analysisPhasesAll": "Todas las fases",
  "agents.analysisPhasesCustom": "Personalizado",
  "agents.customProvider": "API personalizada",
  "agents.customProviderDesc": "Cualquier endpoint compatible con OpenAI — OpenCode Go/Zen, OpenRouter, DeepSeek o tu propia URL",
  "agents.customPreset": "Ajuste preestablecido del proveedor",
  "agents.customBaseUrl": "URL base",
  "agents.customApiKey": "Clave de API",
  "agents.customModelIds": "ID de modelos (separados por comas, opcional)",
  "agents.customNativeSearch": "El modelo tiene búsqueda web integrada",
  "agents.customNativeSearchHint": "Si está activado, la herramienta de búsqueda web de la app no se ofrece a este endpoint",
  "agents.customModels": "Modelos personalizados",
  "agents.searchProvider": "Proveedor de búsqueda",
  "agents.searchApiKey": "Clave de API de búsqueda",
  "agents.searchKeyHint": "La investigación web en vivo necesita una clave de proveedor de búsqueda (Tavily o Brave)",
  "agents.customKeyStoredPlain": "Este navegador almacena las claves sin cifrar. Usa la app de escritorio para almacenamiento cifrado.",
  "agents.customKeyNotEncrypted": "El cifrado del sistema operativo no está disponible; la clave no se guardó. Activa el llavero de tu sistema e inténtalo de nuevo.",
  "agents.customConnect": "Conectar",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Página no encontrada",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "Analista de Teoría de Juegos",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "No se puede cambiar el modelo mientras el análisis está en ejecución. Detenga el análisis primero.",
  "analysis.unsavedChanges":
    "Tiene cambios de análisis sin guardar. ¿Descartarlos e iniciar un nuevo análisis?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "Preparando análisis de fase.",
  "analysis.activity.researching": "Investigando evidencia.",
  "analysis.activity.synthesizing": "Sintetizando resultado de fase.",
  "analysis.activity.validating": "Validando salida estructurada.",
  "analysis.activity.retrying":
    "Reintentando fase tras error de validación o transporte.",
  "analysis.activity.default": "Continuando análisis de fase.",
  "analysis.activity.usingTool": "Usando {{toolName}}",
  "analysis.activity.usingWebSearchQuery":
    "Usando WebSearch: {{query}}",
  "analysis.activity.agentProgress": "Progreso del agente",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Fase {{number}} falló",
  "analysis.progress.phaseLabel": "Fase {{number}}: {{name}}",
  "analysis.progress.phasesComplete":
    "{{completed}}/{{total}} fases completadas",
  "analysis.progress.entityCount": "{{count}} entidad",
  "analysis.progress.entityCountPlural": "{{count}} entidades",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "tiempo agotado",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "error del proveedor",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "Contextualización Situacional",
  "analysis.phases.playerIdentification": "Identificación de Jugadores",
  "analysis.phases.baselineModel": "Modelo Base",
  "analysis.phases.historicalGame": "Juego Histórico",
  "analysis.phases.revalidation": "Revalidación",
  "analysis.phases.formalModeling": "Modelado Formal",
  "analysis.phases.assumptions": "Supuestos",
  "analysis.phases.elimination": "Eliminación",
  "analysis.phases.scenarios": "Escenarios",
  "analysis.phases.metaCheck": "Meta-Verificación",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "Reejecutar fase",
  "analysis.sidebar.searchEntities": "Buscar entidades...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "Hecho",
  "analysis.entities.player": "Jugador",
  "analysis.entities.objective": "Objetivo",
  "analysis.entities.game": "Juego",
  "analysis.entities.strategy": "Estrategia",
  "analysis.entities.payoff": "Pago",
  "analysis.entities.rule": "Regla",
  "analysis.entities.escalation": "Escalada",
  "analysis.entities.history": "Historial",
  "analysis.entities.pattern": "Patrón",
  "analysis.entities.trust": "Confianza",
  "analysis.entities.commitment": "Compromiso",
  "analysis.entities.signal": "Señal",
  "analysis.entities.matrix": "Matriz",
  "analysis.entities.gameTree": "Árbol de Juego",
  "analysis.entities.equilibrium": "Equilibrio",
  "analysis.entities.constraints": "Restricciones",
  "analysis.entities.crossGame": "Juego Cruzado",
  "analysis.entities.signalClass": "Clase de Señal",
  "analysis.entities.bargaining": "Negociación",
  "analysis.entities.optionValue": "Valor de Opción",
  "analysis.entities.behavioral": "Conductual",
  "analysis.entities.assumption": "Supuesto",
  "analysis.entities.eliminated": "Eliminado",
  "analysis.entities.scenario": "Escenario",
  "analysis.entities.thesis": "Tesis",
  "analysis.entities.metaCheck": "Meta-Verificación",
  "analysis.entities.confidence.high": "Alta",
  "analysis.entities.confidence.medium": "Media",
  "analysis.entities.confidence.low": "Baja",
  "analysis.entities.source.ai": "IA",
  "analysis.entities.source.human": "Humano",
} as const;

export default es;
