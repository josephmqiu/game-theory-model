import type { TranslationKeys } from "./en";

const pt: TranslationKeys = {
  // ── Common ──
  "common.connect": "Conectar",
  "common.disconnect": "Desconectar",
  "common.best": "Melhor",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "Novo",
  "topbar.open": "Abrir",
  "topbar.save": "Salvar",
  "topbar.fullscreen": "Tela cheia",
  "topbar.exitFullscreen": "Sair da tela cheia",
  "topbar.newAnalysis": "Nova an\u00e1lise",
  "topbar.unsavedFile": "Arquivo .gta n\u00e3o salvo",
  "topbar.tooltipNew": "Iniciar uma nova an\u00e1lise",
  "topbar.tooltipOpen": "Abrir uma an\u00e1lise .gta salva",
  "topbar.tooltipSave": "Salvar a an\u00e1lise atual",
  "topbar.edited": "— Editado",
  "topbar.agentsAndMcp": "Agentes & MCP",
  "topbar.setupAgentsMcp": "Configurar Agentes & MCP",
  "topbar.connected": "conectado",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "Atualização de Software",
  "updater.dismiss": "Dispensar",
  "updater.current": "Atual",
  "updater.latest": "Mais recente",
  "updater.unknown": "Desconhecido",
  "updater.checking": "Verificando...",
  "updater.downloadProgress": "Progresso do download",
  "updater.checkAgain": "Verificar novamente",
  "updater.restartInstall": "Reiniciar e instalar",
  "updater.installing": "Instalando...",
  "updater.releaseDate": "Data de lançamento: {{date}}",
  "updater.restartHint":
    "Reinicie para aplicar a atualização. A reinicialização geralmente leva de 10 a 15 segundos.",
  "updater.unknownError": "Erro desconhecido do atualizador.",
  "updater.title.checking": "Verificando atualizações",
  "updater.title.available": "Atualização encontrada",
  "updater.title.downloading": "Baixando atualização",
  "updater.title.downloaded": "Pronto para instalar",
  "updater.title.error": "Atualização falhou",
  "updater.subtitle.checking": "Procurando a versão mais recente...",
  "updater.subtitle.available": "A versão {{version}} está disponível.",
  "updater.subtitle.availableGeneric": "Uma nova versão está disponível.",
  "updater.subtitle.downloading":
    "A versão {{version}} está sendo baixada em segundo plano.",
  "updater.subtitle.downloadingGeneric":
    "Baixando pacote de atualização em segundo plano.",
  "updater.subtitle.downloaded": "A versão {{version}} foi baixada.",
  "updater.subtitle.downloadedGeneric": "A atualização foi baixada.",
  "updater.subtitle.error":
    "Não foi possível verificar ou baixar a atualização.",

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
  "ai.newChat": "Novo chat",
  "ai.collapse": "Recolher",
  "ai.generating": "Gerando...",
  "ai.stopGenerating": "Parar geração",
  "ai.sendMessage": "Enviar mensagem",
  "ai.loadingModels": "Carregando modelos...",
  "ai.noModelsConnected": "Nenhum modelo conectado",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "Configurar Agentes & MCP",
  "agents.agentsOnCanvas": "Agentes no Canvas",
  "agents.mcpIntegrations": "Integrações MCP no Terminal",
  "agents.port": "Porta",
  "agents.mcpRestart":
    "As integrações MCP entrarão em vigor após reiniciar o terminal.",
  "agents.modelCount": "{{count}} modelo(s)",
  "agents.connectionFailed": "Falha na conexão",
  "agents.serverError": "Erro do servidor {{status}}",
  "agents.failedTo": "Falha ao {{action}}",
  "agents.failedToMcp": "Falha ao {{action}} servidor MCP",
  "agents.claudeModels": "Modelos Claude",
  "agents.openaiModels": "Modelos OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ provedores de LLM",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "Modelos GitHub Copilot",
  "agents.mcpServer": "Servidor MCP",
  "agents.mcpServerStop": "Parar",
  "agents.mcpServerRunning": "Em execução",
  "agents.mcpServerStopped": "Parado",
  "agents.mcpClientConfig": "Config. do cliente",
  "agents.autoUpdate": "Verificar atualizações automaticamente",
  "agents.notInstalled": "Não instalado",
  "agents.install": "Instalar",
  "agents.installing": "Instalando...",
  "agents.installFailed": "Falha na instalação",
  "agents.viewDocs": "Docs",
  "agents.analysisRuntime": "Motor de an\u00e1lise",
  "agents.analysisWebSearch": "Pesquisa web",
  "agents.analysisWebSearchHint":
    "Usar pesquisa web ao vivo durante as an\u00e1lises.",
  "agents.analysisEffort": "Esfor\u00e7o de an\u00e1lise",
  "agents.analysisEffortHint":
    "Controla a profundidade da an\u00e1lise, n\u00e3o a sele\u00e7\u00e3o de modelo.",
  "agents.analysisEffortQuick": "R\u00e1pido",
  "agents.analysisEffortStandard": "Padr\u00e3o",
  "agents.analysisEffortThorough": "Minucioso",
  "agents.analysisPhases": "Sele\u00e7\u00e3o de fases",
  "agents.analysisPhasesHint":
    "A execu\u00e7\u00e3o personalizada executa apenas as fases selecionadas e pode desativar a revalida\u00e7\u00e3o autom\u00e1tica posterior.",
  "agents.analysisPhasesAll": "Todas as fases",
  "agents.analysisPhasesCustom": "Personalizado",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Página não encontrada",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "Analista de Teoria dos Jogos",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "Não é possível trocar o modelo enquanto a análise está em execução. Pare a análise primeiro.",
  "analysis.unsavedChanges":
    "Você tem alterações de análise não salvas. Descartá-las e iniciar uma nova análise?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "Preparando análise de fase.",
  "analysis.activity.researching": "Pesquisando evidências.",
  "analysis.activity.synthesizing": "Sintetizando resultado da fase.",
  "analysis.activity.validating": "Validando saída estruturada.",
  "analysis.activity.retrying":
    "Repetindo fase após erro de validação ou transporte.",
  "analysis.activity.default": "Continuando análise de fase.",
  "analysis.activity.usingTool": "Usando {{toolName}}",
  "analysis.activity.usingWebSearchQuery":
    "Usando WebSearch: {{query}}",
  "analysis.activity.agentProgress": "Progresso do agente",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Fase {{number}} falhou",
  "analysis.progress.phaseLabel": "Fase {{number}}: {{name}}",
  "analysis.progress.phasesComplete":
    "{{completed}}/{{total}} fases concluídas",
  "analysis.progress.entityCount": "{{count}} entidade",
  "analysis.progress.entityCountPlural": "{{count}} entidades",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "tempo esgotado",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "erro do provedor",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "Contextualização Situacional",
  "analysis.phases.playerIdentification": "Identificação de Jogadores",
  "analysis.phases.baselineModel": "Modelo Base",
  "analysis.phases.historicalGame": "Jogo Histórico",
  "analysis.phases.revalidation": "Revalidação",
  "analysis.phases.formalModeling": "Modelagem Formal",
  "analysis.phases.assumptions": "Premissas",
  "analysis.phases.elimination": "Eliminação",
  "analysis.phases.scenarios": "Cenários",
  "analysis.phases.metaCheck": "Meta-Verificação",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "Reexecutar fase",
  "analysis.sidebar.searchEntities": "Buscar entidades...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "Fato",
  "analysis.entities.player": "Jogador",
  "analysis.entities.objective": "Objetivo",
  "analysis.entities.game": "Jogo",
  "analysis.entities.strategy": "Estratégia",
  "analysis.entities.payoff": "Payoff",
  "analysis.entities.rule": "Regra",
  "analysis.entities.escalation": "Escalada",
  "analysis.entities.history": "Histórico",
  "analysis.entities.pattern": "Padrão",
  "analysis.entities.trust": "Confiança",
  "analysis.entities.commitment": "Compromisso",
  "analysis.entities.signal": "Sinal",
  "analysis.entities.matrix": "Matriz",
  "analysis.entities.gameTree": "Árvore de Jogo",
  "analysis.entities.equilibrium": "Equilíbrio",
  "analysis.entities.constraints": "Restrições",
  "analysis.entities.crossGame": "Jogo Cruzado",
  "analysis.entities.signalClass": "Classe de Sinal",
  "analysis.entities.bargaining": "Barganha",
  "analysis.entities.optionValue": "Valor de Opção",
  "analysis.entities.behavioral": "Comportamental",
  "analysis.entities.assumption": "Premissa",
  "analysis.entities.eliminated": "Eliminado",
  "analysis.entities.scenario": "Cenário",
  "analysis.entities.thesis": "Tese",
  "analysis.entities.metaCheck": "Meta-Verificação",
  "analysis.entities.confidence.high": "Alta",
  "analysis.entities.confidence.medium": "Média",
  "analysis.entities.confidence.low": "Baixa",
  "analysis.entities.source.ai": "IA",
  "analysis.entities.source.human": "Humano",
} as const;

export default pt;
