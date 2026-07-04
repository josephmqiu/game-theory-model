import type { TranslationKeys } from "./en";

const zh: TranslationKeys = {
  // ── Common ──
  "common.connect": "连接",
  "common.disconnect": "断开连接",
  "common.best": "最佳",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "新建",
  "topbar.open": "打开",
  "topbar.save": "保存",
  "topbar.fullscreen": "全屏",
  "topbar.exitFullscreen": "退出全屏",
  "topbar.newAnalysis": "新建分析",
  "topbar.unsavedFile": "未保存的 .gta 文件",
  "topbar.tooltipNew": "开始一个新的分析",
  "topbar.tooltipOpen": "打开已保存的 .gta 分析",
  "topbar.tooltipSave": "保存当前分析",
  "topbar.edited": "— 已编辑",
  "topbar.agentsAndMcp": "Agents 与 MCP",
  "topbar.setupAgentsMcp": "设置 Agents 与 MCP",
  "topbar.connected": "已连接",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "软件更新",
  "updater.dismiss": "关闭",
  "updater.current": "当前版本",
  "updater.latest": "最新版本",
  "updater.unknown": "未知",
  "updater.checking": "检查中...",
  "updater.downloadProgress": "下载进度",
  "updater.checkAgain": "再次检查",
  "updater.restartInstall": "重启并安装",
  "updater.installing": "安装中...",
  "updater.releaseDate": "发布日期：{{date}}",
  "updater.restartHint": "重启以应用更新。重启通常需要 10-15 秒。",
  "updater.unknownError": "未知更新错误。",
  "updater.title.checking": "正在检查更新",
  "updater.title.available": "发现新版本",
  "updater.title.downloading": "正在下载更新",
  "updater.title.downloaded": "准备安装",
  "updater.title.error": "更新失败",
  "updater.subtitle.checking": "正在查找最新版本...",
  "updater.subtitle.available": "版本 {{version}} 已可用。",
  "updater.subtitle.availableGeneric": "有新版本可用。",
  "updater.subtitle.downloading": "版本 {{version}} 正在后台下载。",
  "updater.subtitle.downloadingGeneric": "正在后台下载更新包。",
  "updater.subtitle.downloaded": "版本 {{version}} 已下载完成。",
  "updater.subtitle.downloadedGeneric": "更新已下载完成。",
  "updater.subtitle.error": "无法检查或下载更新。",

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
  "ai.newChat": "新对话",
  "ai.collapse": "收起",
  "ai.generating": "生成中...",
  "ai.stopGenerating": "停止生成",
  "ai.sendMessage": "发送消息",
  "ai.loadingModels": "正在加载模型...",
  "ai.noModelsConnected": "未连接模型",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "设置 Agents 与 MCP",
  "agents.agentsOnCanvas": "画布上的 Agents",
  "agents.mcpIntegrations": "终端中的 MCP 集成",
  "agents.port": "端口",
  "agents.mcpRestart": "MCP 集成将在重启终端后生效。",
  "agents.modelCount": "{{count}} 个模型",
  "agents.connectionFailed": "连接失败",
  "agents.serverError": "服务器错误 {{status}}",
  "agents.failedTo": "{{action}}失败",
  "agents.failedToMcp": "{{action}} MCP 服务器失败",
  "agents.claudeModels": "Claude 模型",
  "agents.openaiModels": "OpenAI 模型",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ LLM 提供商",
  "agents.mcpServer": "MCP 服务器",
  "agents.mcpServerStop": "停止",
  "agents.mcpServerRunning": "运行中",
  "agents.mcpServerStopped": "已停止",
  "agents.mcpClientConfig": "客户端配置",
  "agents.autoUpdate": "自动检查更新",
  "agents.notInstalled": "未安装",
  "agents.install": "安装",
  "agents.installing": "安装中...",
  "agents.installFailed": "安装失败",
  "agents.viewDocs": "文档",
  "agents.analysisRuntime": "分析运行时",
  "agents.analysisWebSearch": "网络搜索",
  "agents.analysisWebSearchHint": "在分析运行期间使用实时网络研究。",
  "agents.analysisEffort": "分析力度",
  "agents.analysisEffortHint": "控制分析运行的深度指导，不影响模型选择。",
  "agents.analysisEffortQuick": "快速",
  "agents.analysisEffortStandard": "标准",
  "agents.analysisEffortThorough": "深入",
  "agents.analysisPhases": "阶段选择",
  "agents.analysisPhasesHint":
    "自定义阶段仅运行选定的阶段，可能会禁用自动下游重新验证。",
  "agents.analysisPhasesAll": "所有阶段",
  "agents.analysisPhasesCustom": "自定义",
  "agents.customProvider": "自定义 API",
  "agents.customProviderDesc": "任何兼容 OpenAI 的端点 — OpenCode Go/Zen、OpenRouter、DeepSeek 或您自己的 URL",
  "agents.customPreset": "提供商预设",
  "agents.customBaseUrl": "基础 URL",
  "agents.customApiKey": "API 密钥",
  "agents.customModelIds": "模型 ID（以逗号分隔，可选）",
  "agents.customNativeSearch": "模型内置网络搜索",
  "agents.customNativeSearchHint": "启用后，应用的网络搜索工具不会提供给此端点",
  "agents.customModels": "自定义模型",
  "agents.searchProvider": "搜索提供商",
  "agents.searchApiKey": "搜索 API 密钥",
  "agents.searchKeyHint": "实时网络研究需要搜索提供商密钥（Tavily 或 Brave）",
  "agents.customKeyStoredPlain": "此浏览器以未加密方式存储密钥。请使用桌面应用进行加密存储。",
  "agents.customKeyNotEncrypted": "操作系统加密不可用；密钥未保存。请启用系统钥匙串后重试。",
  "agents.customConnect": "连接",
  "agents.searchProviderNone": "无",
  "agents.customClearKey": "清除 API 密钥",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "页面未找到",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "博弈论分析师",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel": "分析运行期间无法切换模型。请先停止分析。",
  "analysis.unsavedChanges": "您有未保存的分析更改。放弃并开始新的分析？",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "正在准备阶段分析。",
  "analysis.activity.researching": "正在研究证据。",
  "analysis.activity.synthesizing": "正在综合阶段输出。",
  "analysis.activity.validating": "正在验证结构化输出。",
  "analysis.activity.retrying": "验证或传输问题后正在重试阶段。",
  "analysis.activity.default": "正在继续阶段分析。",
  "analysis.activity.usingTool": "正在使用 {{toolName}}",
  "analysis.activity.usingWebSearchQuery": "正在使用 WebSearch：{{query}}",
  "analysis.activity.agentProgress": "Agent 进度",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "阶段 {{number}} 失败",
  "analysis.progress.phaseLabel": "阶段 {{number}}：{{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} 个阶段已完成",
  "analysis.progress.entityCount": "{{count}} 个实体",
  "analysis.progress.entityCountPlural": "{{count}} 个实体",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "超时",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "提供商错误",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "情境奠基",
  "analysis.phases.playerIdentification": "参与者识别",
  "analysis.phases.baselineModel": "基准模型",
  "analysis.phases.historicalGame": "历史博弈",
  "analysis.phases.revalidation": "重新验证",
  "analysis.phases.formalModeling": "形式化建模",
  "analysis.phases.assumptions": "假设",
  "analysis.phases.elimination": "消元",
  "analysis.phases.scenarios": "情景推演",
  "analysis.phases.metaCheck": "元检查",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "重新运行阶段",
  "analysis.sidebar.searchEntities": "搜索实体...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "事实",
  "analysis.entities.player": "参与者",
  "analysis.entities.objective": "目标",
  "analysis.entities.game": "博弈",
  "analysis.entities.strategy": "策略",
  "analysis.entities.payoff": "收益",
  "analysis.entities.rule": "规则",
  "analysis.entities.escalation": "升级",
  "analysis.entities.history": "历史",
  "analysis.entities.pattern": "模式",
  "analysis.entities.trust": "信任",
  "analysis.entities.commitment": "承诺",
  "analysis.entities.signal": "信号",
  "analysis.entities.matrix": "矩阵",
  "analysis.entities.gameTree": "博弈树",
  "analysis.entities.equilibrium": "均衡",
  "analysis.entities.constraints": "约束",
  "analysis.entities.crossGame": "跨博弈",
  "analysis.entities.signalClass": "信号类别",
  "analysis.entities.bargaining": "谈判",
  "analysis.entities.optionValue": "期权价值",
  "analysis.entities.behavioral": "行为",
  "analysis.entities.assumption": "假设",
  "analysis.entities.eliminated": "已消除",
  "analysis.entities.scenario": "情景",
  "analysis.entities.thesis": "论点",
  "analysis.entities.metaCheck": "元检查",
  "analysis.entities.confidence.high": "高",
  "analysis.entities.confidence.medium": "中",
  "analysis.entities.confidence.low": "低",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "人工",
} as const;

export default zh;
