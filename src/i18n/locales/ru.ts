import type { TranslationKeys } from "./en";

const ru: TranslationKeys = {
  // ── Common ──
  "common.connect": "Подключить",
  "common.disconnect": "Отключить",
  "common.best": "Лучшее",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "Новый",
  "topbar.open": "Открыть",
  "topbar.save": "Сохранить",
  "topbar.fullscreen": "Полный экран",
  "topbar.exitFullscreen": "Выйти из полноэкранного режима",
  "topbar.newAnalysis":
    "\u041d\u043e\u0432\u044b\u0439 \u0430\u043d\u0430\u043b\u0438\u0437",
  "topbar.unsavedFile":
    "\u041d\u0435\u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0439 \u0444\u0430\u0439\u043b .gta",
  "topbar.tooltipNew":
    "\u041d\u0430\u0447\u0430\u0442\u044c \u043d\u043e\u0432\u044b\u0439 \u0430\u043d\u0430\u043b\u0438\u0437",
  "topbar.tooltipOpen":
    "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0439 \u0430\u043d\u0430\u043b\u0438\u0437 .gta",
  "topbar.tooltipSave":
    "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u0430\u043d\u0430\u043b\u0438\u0437",
  "topbar.edited": "— Изменено",
  "topbar.agentsAndMcp": "Агенты и MCP",
  "topbar.setupAgentsMcp": "Настройка агентов и MCP",
  "topbar.connected": "подключено",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "Обновление ПО",
  "updater.dismiss": "Закрыть",
  "updater.current": "Текущая",
  "updater.latest": "Последняя",
  "updater.unknown": "Неизвестно",
  "updater.checking": "Проверка...",
  "updater.downloadProgress": "Прогресс загрузки",
  "updater.checkAgain": "Проверить ещё раз",
  "updater.restartInstall": "Перезапуск и установка",
  "updater.installing": "Установка...",
  "updater.releaseDate": "Дата выпуска: {{date}}",
  "updater.restartHint":
    "Перезапустите приложение для применения обновления. Перезапуск обычно занимает 10–15 секунд.",
  "updater.unknownError": "Неизвестная ошибка обновления.",
  "updater.title.checking": "Проверка обновлений",
  "updater.title.available": "Обновление найдено",
  "updater.title.downloading": "Загрузка обновления",
  "updater.title.downloaded": "Готово к установке",
  "updater.title.error": "Ошибка обновления",
  "updater.subtitle.checking": "Поиск последней версии...",
  "updater.subtitle.available": "Доступна версия {{version}}.",
  "updater.subtitle.availableGeneric": "Доступна новая версия.",
  "updater.subtitle.downloading":
    "Версия {{version}} загружается в фоновом режиме.",
  "updater.subtitle.downloadingGeneric":
    "Пакет обновления загружается в фоновом режиме.",
  "updater.subtitle.downloaded": "Версия {{version}} загружена.",
  "updater.subtitle.downloadedGeneric": "Обновление загружено.",
  "updater.subtitle.error": "Не удалось проверить или загрузить обновление.",

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
  "ai.newChat": "Новый чат",
  "ai.collapse": "Свернуть",
  "ai.generating": "Генерация...",
  "ai.stopGenerating": "Остановить генерацию",
  "ai.sendMessage": "Отправить сообщение",
  "ai.loadingModels": "Загрузка моделей...",
  "ai.noModelsConnected": "Нет подключённых моделей",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "Настройка агентов и MCP",
  "agents.agentsOnCanvas": "Агенты на холсте",
  "agents.mcpIntegrations": "Интеграции MCP в терминале",
  "agents.port": "Порт",
  "agents.mcpRestart":
    "Интеграции MCP вступят в силу после перезапуска терминала.",
  "agents.modelCount": "{{count}} модель(ей)",
  "agents.connectionFailed": "Ошибка подключения",
  "agents.serverError": "Ошибка сервера {{status}}",
  "agents.failedTo": "Не удалось выполнить {{action}}",
  "agents.failedToMcp": "Не удалось {{action}} сервер MCP",
  "agents.claudeModels": "Модели Claude",
  "agents.openaiModels": "Модели OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ провайдеров LLM",
  "agents.mcpServer": "MCP Сервер",
  "agents.mcpServerStop": "Остановить",
  "agents.mcpServerRunning": "Работает",
  "agents.mcpServerStopped": "Остановлен",
  "agents.mcpClientConfig": "Конфиг клиента",
  "agents.autoUpdate": "Автоматически проверять обновления",
  "agents.notInstalled": "Не установлено",
  "agents.install": "Установить",
  "agents.installing": "Установка...",
  "agents.installFailed": "Ошибка установки",
  "agents.viewDocs": "Документация",
  "agents.analysisRuntime":
    "\u0421\u0440\u0435\u0434\u0430 \u0430\u043d\u0430\u043b\u0438\u0437\u0430",
  "agents.analysisWebSearch":
    "\u041f\u043e\u0438\u0441\u043a \u0432 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442\u0435",
  "agents.analysisWebSearchHint":
    "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c \u0432\u0435\u0431-\u0438\u0441\u0441\u043b\u0435\u0434\u043e\u0432\u0430\u043d\u0438\u0435 \u0432\u043e \u0432\u0440\u0435\u043c\u044f \u0430\u043d\u0430\u043b\u0438\u0437\u0430.",
  "agents.analysisEffort":
    "\u0413\u043b\u0443\u0431\u0438\u043d\u0430 \u0430\u043d\u0430\u043b\u0438\u0437\u0430",
  "agents.analysisEffortHint":
    "\u0423\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u0442 \u0433\u043b\u0443\u0431\u0438\u043d\u043e\u0439 \u0430\u043d\u0430\u043b\u0438\u0437\u0430, \u0430 \u043d\u0435 \u0432\u044b\u0431\u043e\u0440\u043e\u043c \u043c\u043e\u0434\u0435\u043b\u0438.",
  "agents.analysisEffortQuick": "\u0411\u044b\u0441\u0442\u0440\u044b\u0439",
  "agents.analysisEffortStandard":
    "\u0421\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u043d\u044b\u0439",
  "agents.analysisEffortThorough":
    "\u0422\u0449\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0439",
  "agents.analysisPhases": "\u0412\u044b\u0431\u043e\u0440 \u0444\u0430\u0437",
  "agents.analysisPhasesHint":
    "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439 \u0437\u0430\u043f\u0443\u0441\u043a \u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u0444\u0430\u0437\u044b \u0438 \u043c\u043e\u0436\u0435\u0442 \u043e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0443\u044e \u043f\u043e\u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0443\u044e \u0440\u0435\u0432\u0430\u043b\u0438\u0434\u0430\u0446\u0438\u044e.",
  "agents.analysisPhasesAll": "\u0412\u0441\u0435 \u0444\u0430\u0437\u044b",
  "agents.analysisPhasesCustom":
    "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439",
  "agents.customProvider": "Пользовательский API",
  "agents.customProviderDesc": "Любая совместимая с OpenAI конечная точка — OpenCode Go/Zen, OpenRouter, DeepSeek или ваш собственный URL",
  "agents.customPreset": "Предустановка провайдера",
  "agents.customBaseUrl": "Базовый URL",
  "agents.customApiKey": "Ключ API",
  "agents.customModelIds": "Идентификаторы моделей (через запятую, необязательно)",
  "agents.customNativeSearch": "У модели есть встроенный веб-поиск",
  "agents.customNativeSearchHint": "Когда включено, инструмент веб-поиска приложения не предлагается этой конечной точке",
  "agents.customModels": "Пользовательские модели",
  "agents.searchProvider": "Провайдер поиска",
  "agents.searchApiKey": "Ключ API поиска",
  "agents.searchKeyHint": "Для живого веб-исследования нужен ключ провайдера поиска (Tavily или Brave)",
  "agents.customKeyStoredPlain": "Этот браузер хранит ключи без шифрования. Используйте настольное приложение для зашифрованного хранения.",
  "agents.customKeyNotEncrypted": "Шифрование ОС недоступно; ключ не сохранён. Включите системную связку ключей и повторите попытку.",
  "agents.customConnect": "Подключить",
  "agents.searchProviderNone": "Нет",
  "agents.customClearKey": "Очистить ключ API",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Страница не найдена",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "Аналитик теории игр",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "Невозможно сменить модель во время выполнения анализа. Сначала остановите анализ.",
  "analysis.unsavedChanges":
    "У вас есть несохранённые изменения анализа. Отменить их и начать новый анализ?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "Подготовка фазового анализа.",
  "analysis.activity.researching": "Исследование доказательств.",
  "analysis.activity.synthesizing": "Синтез результата фазы.",
  "analysis.activity.validating": "Валидация структурированного вывода.",
  "analysis.activity.retrying":
    "Повторная попытка фазы после ошибки валидации или транспорта.",
  "analysis.activity.default": "Продолжение фазового анализа.",
  "analysis.activity.usingTool": "Использование {{toolName}}",
  "analysis.activity.usingWebSearchQuery":
    "Использование WebSearch: {{query}}",
  "analysis.activity.agentProgress": "Прогресс агента",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Фаза {{number}} не выполнена",
  "analysis.progress.phaseLabel": "Фаза {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} фаз завершено",
  "analysis.progress.entityCount": "{{count}} сущность",
  "analysis.progress.entityCountPlural": "{{count}} сущностей",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "тайм-аут",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "ошибка провайдера",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "Ситуационная привязка",
  "analysis.phases.playerIdentification": "Идентификация игроков",
  "analysis.phases.baselineModel": "Базовая модель",
  "analysis.phases.historicalGame": "Историческая игра",
  "analysis.phases.revalidation": "Ревалидация",
  "analysis.phases.formalModeling": "Формальное моделирование",
  "analysis.phases.assumptions": "Допущения",
  "analysis.phases.elimination": "Элиминация",
  "analysis.phases.scenarios": "Сценарии",
  "analysis.phases.metaCheck": "Мета-проверка",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "Перезапустить фазу",
  "analysis.sidebar.searchEntities": "Поиск сущностей...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "Факт",
  "analysis.entities.player": "Игрок",
  "analysis.entities.objective": "Цель",
  "analysis.entities.game": "Игра",
  "analysis.entities.strategy": "Стратегия",
  "analysis.entities.payoff": "Выигрыш",
  "analysis.entities.rule": "Правило",
  "analysis.entities.escalation": "Эскалация",
  "analysis.entities.history": "История",
  "analysis.entities.pattern": "Паттерн",
  "analysis.entities.trust": "Доверие",
  "analysis.entities.commitment": "Обязательство",
  "analysis.entities.signal": "Сигнал",
  "analysis.entities.matrix": "Матрица",
  "analysis.entities.gameTree": "Дерево игры",
  "analysis.entities.equilibrium": "Равновесие",
  "analysis.entities.constraints": "Ограничения",
  "analysis.entities.crossGame": "Перекрёстная игра",
  "analysis.entities.signalClass": "Класс сигналов",
  "analysis.entities.bargaining": "Торг",
  "analysis.entities.optionValue": "Ценность опциона",
  "analysis.entities.behavioral": "Поведенческий",
  "analysis.entities.assumption": "Допущение",
  "analysis.entities.eliminated": "Элиминирован",
  "analysis.entities.scenario": "Сценарий",
  "analysis.entities.thesis": "Тезис",
  "analysis.entities.metaCheck": "Мета-проверка",
  "analysis.entities.confidence.high": "Высокая",
  "analysis.entities.confidence.medium": "Средняя",
  "analysis.entities.confidence.low": "Низкая",
  "analysis.entities.source.ai": "ИИ",
  "analysis.entities.source.human": "Человек",
} as const;

export default ru;
