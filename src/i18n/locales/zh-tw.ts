import type { TranslationKeys } from "./en";

const zhTW: TranslationKeys = {
  // ── Common ──
  "common.connect": "連線",
  "common.disconnect": "中斷連線",
  "common.best": "最佳",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "新增",
  "topbar.open": "開啟",
  "topbar.save": "儲存",
  "topbar.fullscreen": "全螢幕",
  "topbar.exitFullscreen": "退出全螢幕",
  "topbar.newAnalysis": "新增分析",
  "topbar.unsavedFile": "未儲存的 .gta 檔案",
  "topbar.tooltipNew": "開始一個新的分析",
  "topbar.tooltipOpen": "開啟已儲存的 .gta 分析",
  "topbar.tooltipSave": "儲存目前的分析",
  "topbar.edited": "— 已編輯",
  "topbar.agentsAndMcp": "Agents 與 MCP",
  "topbar.setupAgentsMcp": "設定 Agents 與 MCP",
  "topbar.connected": "已連線",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "軟體更新",
  "updater.dismiss": "關閉",
  "updater.current": "目前版本",
  "updater.latest": "最新版本",
  "updater.unknown": "未知",
  "updater.checking": "檢查中...",
  "updater.downloadProgress": "下載進度",
  "updater.checkAgain": "再次檢查",
  "updater.restartInstall": "重新啟動並安裝",
  "updater.installing": "安裝中...",
  "updater.releaseDate": "發佈日期：{{date}}",
  "updater.restartHint": "重新啟動以套用更新。重啟通常需要 10-15 秒。",
  "updater.unknownError": "未知的更新錯誤。",
  "updater.title.checking": "正在檢查更新",
  "updater.title.available": "發現新版本",
  "updater.title.downloading": "正在下載更新",
  "updater.title.downloaded": "準備安裝",
  "updater.title.error": "更新失敗",
  "updater.subtitle.checking": "正在尋找最新版本...",
  "updater.subtitle.available": "版本 {{version}} 已可用。",
  "updater.subtitle.availableGeneric": "有新版本可用。",
  "updater.subtitle.downloading": "版本 {{version}} 正在背景下載。",
  "updater.subtitle.downloadingGeneric": "正在背景下載更新套件。",
  "updater.subtitle.downloaded": "版本 {{version}} 已下載完成。",
  "updater.subtitle.downloadedGeneric": "更新已下載完成。",
  "updater.subtitle.error": "無法檢查或下載更新。",

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
  "ai.newChat": "新對話",
  "ai.collapse": "收合",
  "ai.generating": "產生中...",
  "ai.stopGenerating": "停止產生",
  "ai.sendMessage": "傳送訊息",
  "ai.loadingModels": "正在載入模型...",
  "ai.noModelsConnected": "尚未連線模型",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "設定 Agents 與 MCP",
  "agents.agentsOnCanvas": "畫布上的 Agents",
  "agents.mcpIntegrations": "終端機中的 MCP 整合",
  "agents.port": "連接埠",
  "agents.mcpRestart": "MCP 整合將在重新啟動終端機後生效。",
  "agents.modelCount": "{{count}} 個模型",
  "agents.connectionFailed": "連線失敗",
  "agents.serverError": "伺服器錯誤 {{status}}",
  "agents.failedTo": "{{action}}失敗",
  "agents.failedToMcp": "{{action}} MCP 伺服器失敗",
  "agents.claudeModels": "Claude 模型",
  "agents.openaiModels": "OpenAI 模型",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ LLM 供應商",
  "agents.mcpServer": "MCP 伺服器",
  "agents.mcpServerStop": "停止",
  "agents.mcpServerRunning": "執行中",
  "agents.mcpServerStopped": "已停止",
  "agents.mcpClientConfig": "客戶端配置",
  "agents.autoUpdate": "自動檢查更新",
  "agents.notInstalled": "未安裝",
  "agents.install": "安裝",
  "agents.installing": "安裝中...",
  "agents.installFailed": "安裝失敗",
  "agents.viewDocs": "文件",
  "agents.analysisRuntime": "分析執行環境",
  "agents.analysisWebSearch": "網路搜尋",
  "agents.analysisWebSearchHint": "在分析執行期間使用即時網路研究。",
  "agents.analysisEffort": "分析力度",
  "agents.analysisEffortHint": "控制分析執行的深度指引，不影響模型選擇。",
  "agents.analysisEffortQuick": "快速",
  "agents.analysisEffortStandard": "標準",
  "agents.analysisEffortThorough": "深入",
  "agents.analysisPhases": "階段選擇",
  "agents.analysisPhasesHint":
    "自訂階段僅執行選定的階段，可能會停用自動下游重新驗證。",
  "agents.analysisPhasesAll": "所有階段",
  "agents.analysisPhasesCustom": "自訂",
  "agents.customProvider": "自訂 API",
  "agents.customProviderDesc": "任何相容 OpenAI 的端點 — OpenCode Go/Zen、OpenRouter、DeepSeek 或您自己的 URL",
  "agents.customPreset": "供應商預設",
  "agents.customBaseUrl": "基礎 URL",
  "agents.customApiKey": "API 金鑰",
  "agents.customModelIds": "模型 ID（以逗號分隔，選填）",
  "agents.customNativeSearch": "模型內建網路搜尋",
  "agents.customNativeSearchHint": "啟用後，應用程式的網路搜尋工具不會提供給此端點",
  "agents.customModels": "自訂模型",
  "agents.searchProvider": "搜尋供應商",
  "agents.searchApiKey": "搜尋 API 金鑰",
  "agents.searchKeyHint": "即時網路研究需要搜尋供應商金鑰（Tavily 或 Brave）",
  "agents.customKeyStoredPlain": "此瀏覽器以未加密方式儲存金鑰。請使用桌面應用程式進行加密儲存。",
  "agents.customKeyNotEncrypted": "作業系統加密無法使用；金鑰未儲存。請啟用系統鑰匙圈後再試一次。",
  "agents.customConnect": "連線",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "找不到頁面",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "賽局理論分析師",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel": "分析執行期間無法切換模型。請先停止分析。",
  "analysis.unsavedChanges": "您有未儲存的分析變更。放棄並開始新的分析？",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "正在準備階段分析。",
  "analysis.activity.researching": "正在研究證據。",
  "analysis.activity.synthesizing": "正在綜合階段輸出。",
  "analysis.activity.validating": "正在驗證結構化輸出。",
  "analysis.activity.retrying": "驗證或傳輸問題後正在重試階段。",
  "analysis.activity.default": "正在繼續階段分析。",
  "analysis.activity.usingTool": "正在使用 {{toolName}}",
  "analysis.activity.usingWebSearchQuery": "正在使用 WebSearch：{{query}}",
  "analysis.activity.agentProgress": "Agent 進度",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "階段 {{number}} 失敗",
  "analysis.progress.phaseLabel": "階段 {{number}}：{{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} 個階段已完成",
  "analysis.progress.entityCount": "{{count}} 個實體",
  "analysis.progress.entityCountPlural": "{{count}} 個實體",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "逾時",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "提供商錯誤",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "情境奠基",
  "analysis.phases.playerIdentification": "參與者識別",
  "analysis.phases.baselineModel": "基準模型",
  "analysis.phases.historicalGame": "歷史賽局",
  "analysis.phases.revalidation": "重新驗證",
  "analysis.phases.formalModeling": "形式化建模",
  "analysis.phases.assumptions": "假設",
  "analysis.phases.elimination": "消元",
  "analysis.phases.scenarios": "情境推演",
  "analysis.phases.metaCheck": "元檢查",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "重新執行階段",
  "analysis.sidebar.searchEntities": "搜尋實體...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "事實",
  "analysis.entities.player": "參與者",
  "analysis.entities.objective": "目標",
  "analysis.entities.game": "賽局",
  "analysis.entities.strategy": "策略",
  "analysis.entities.payoff": "報酬",
  "analysis.entities.rule": "規則",
  "analysis.entities.escalation": "升級",
  "analysis.entities.history": "歷史",
  "analysis.entities.pattern": "模式",
  "analysis.entities.trust": "信任",
  "analysis.entities.commitment": "承諾",
  "analysis.entities.signal": "信號",
  "analysis.entities.matrix": "矩陣",
  "analysis.entities.gameTree": "賽局樹",
  "analysis.entities.equilibrium": "均衡",
  "analysis.entities.constraints": "約束",
  "analysis.entities.crossGame": "跨賽局",
  "analysis.entities.signalClass": "信號類別",
  "analysis.entities.bargaining": "議價",
  "analysis.entities.optionValue": "選擇權價值",
  "analysis.entities.behavioral": "行為",
  "analysis.entities.assumption": "假設",
  "analysis.entities.eliminated": "已消除",
  "analysis.entities.scenario": "情境",
  "analysis.entities.thesis": "論點",
  "analysis.entities.metaCheck": "元檢查",
  "analysis.entities.confidence.high": "高",
  "analysis.entities.confidence.medium": "中",
  "analysis.entities.confidence.low": "低",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "人工",
} as const;

export default zhTW;
