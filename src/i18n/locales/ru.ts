import type { TranslationKeys } from "./en";

const ru: TranslationKeys = {
  // ── Common ──
  "common.rename": "Переименовать",
  "common.duplicate": "Дублировать",
  "common.delete": "Удалить",
  "common.cancel": "Отмена",
  "common.save": "Сохранить",
  "common.close": "Закрыть",
  "common.connect": "Подключить",
  "common.disconnect": "Отключить",
  "common.import": "Импорт",
  "common.export": "Экспорт",
  "common.name": "Имя",
  "common.untitled": "Без названия",
  "common.best": "Лучшее",
  "common.selected": "{{count}} выбрано",

  // ── Toolbar ──
  "toolbar.select": "Выделение",
  "toolbar.text": "Текст",
  "toolbar.frame": "Фрейм",
  "toolbar.hand": "Рука",
  "toolbar.undo": "Отменить",
  "toolbar.redo": "Повторить",
  "toolbar.variables": "Переменные",
  "toolbar.uikitBrowser": "Браузер UIKit",

  // ── Shapes ──
  "shapes.rectangle": "Прямоугольник",
  "shapes.ellipse": "Эллипс",
  "shapes.polygon": "Полигон",
  "shapes.line": "Линия",
  "shapes.icon": "Иконка",
  "shapes.importImageSvg": "Импорт изображения или SVG\u2026",
  "shapes.pen": "Перо",
  "shapes.shapeTools": "Инструменты фигур",
  "shapes.moreShapeTools": "Ещё инструменты фигур",

  // ── Top Bar ──
  "topbar.hideLayers": "Скрыть структуру",
  "topbar.showLayers": "Показать структуру",
  "topbar.new": "Новый",
  "topbar.open": "Открыть",
  "topbar.save": "Сохранить",
  "topbar.importFigma": "Импорт из Figma",
  "topbar.codePanel": "Код",
  "topbar.fullscreen": "Полный экран",
  "topbar.exitFullscreen": "Выйти из полноэкранного режима",
  "topbar.newAnalysis":
    "\u041d\u043e\u0432\u044b\u0439 \u0430\u043d\u0430\u043b\u0438\u0437",
  "topbar.unsavedFile":
    "\u041d\u0435\u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0439 \u0444\u0430\u0439\u043b .gta",
  "topbar.complete": "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e",
  "topbar.incomplete":
    "{{count}} \u044f\u0447\u0435\u0435\u043a \u043e\u0441\u0442\u0430\u043b\u043e\u0441\u044c",
  "topbar.issues":
    "{{count}} \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0430(\u044b)",
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
  "topbar.agentStatus": "{{agents}} агент{{agentSuffix}} · {{mcp}} MCP",

  // ── Right Panel ──
  "rightPanel.design": "\u0414\u0435\u0442\u0430\u043b\u0438",
  "rightPanel.code": "Код",
  "rightPanel.noSelection":
    "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u044d\u043b\u0435\u043c\u0435\u043d\u0442",

  // ── Pages ──
  "pages.title": "Страницы",
  "pages.addPage": "Добавить страницу",
  "pages.moveUp": "Переместить вверх",
  "pages.moveDown": "Переместить вниз",

  // ── Status Bar ──
  "statusbar.zoomOut": "Уменьшить масштаб",
  "statusbar.zoomIn": "Увеличить масштаб",
  "statusbar.resetZoom": "Сбросить масштаб",

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
  "layers.title": "\u0421\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430",
  "layers.empty":
    "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u043e\u0432. \u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u043f\u0430\u043d\u0435\u043b\u044c \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u043e\u0432, \u0447\u0442\u043e\u0431\u044b \u043d\u0430\u0447\u0430\u0442\u044c.",

  // ── Layer Context Menu ──
  "layerMenu.groupSelection": "Сгруппировать выделение",
  "layerMenu.createComponent": "Создать компонент",
  "layerMenu.detachComponent": "Отсоединить компонент",
  "layerMenu.detachInstance": "Отсоединить экземпляр",
  "layerMenu.booleanUnion": "Объединение",
  "layerMenu.booleanSubtract": "Вычитание",
  "layerMenu.booleanIntersect": "Пересечение",
  "layerMenu.toggleLock": "Переключить блокировку",
  "layerMenu.toggleVisibility": "Переключить видимость",

  // ── Property Panel ──
  "property.createComponent": "Создать компонент",
  "property.detachComponent": "Отсоединить компонент",
  "property.goToComponent": "Перейти к компоненту",
  "property.detachInstance": "Отсоединить экземпляр",

  // ── Fill ──
  "fill.title": "Заливка",
  "fill.solid": "Сплошная",
  "fill.linear": "Линейная",
  "fill.radial": "Радиальная",
  "fill.image": "Изображение",
  "fill.stops": "Точки",
  "fill.angle": "Угол",

  // ── Image ──
  "image.title": "Изображение",
  "image.fit": "Режим подгонки",
  "image.fill": "Заполнение",
  "image.fitMode": "Вписать",
  "image.crop": "Обрезка",
  "image.tile": "Плитка",
  "image.clickToUpload": "Нажмите для загрузки",
  "image.changeImage": "Изменить изображение",
  "image.adjustments": "Настройки",
  "image.exposure": "Экспозиция",
  "image.contrast": "Контрастность",
  "image.saturation": "Насыщенность",
  "image.temperature": "Температура",
  "image.tint": "Оттенок",
  "image.highlights": "Светлые тона",
  "image.shadows": "Тени",
  "image.reset": "Сбросить",

  // ── Stroke ──
  "stroke.title": "Обводка",

  // ── Appearance ──
  "appearance.layer": "Слой",
  "appearance.opacity": "Непрозрачность",

  // ── Layout ──
  "layout.flexLayout": "Flex-раскладка",
  "layout.freedom": "Свободная (без раскладки)",
  "layout.vertical": "Вертикальная раскладка",
  "layout.horizontal": "Горизонтальная раскладка",
  "layout.alignment": "Выравнивание",
  "layout.gap": "Отступ",
  "layout.spaceBetween": "Пространство между",
  "layout.spaceAround": "Пространство вокруг",
  "layout.dimensions": "Размеры",
  "layout.fillWidth": "Заполнить ширину",
  "layout.fillHeight": "Заполнить высоту",
  "layout.hugWidth": "По содержимому (ш)",
  "layout.hugHeight": "По содержимому (в)",
  "layout.clipContent": "Обрезать содержимое",

  // ── Padding ──
  "padding.title": "Внутренний отступ",
  "padding.paddingMode": "Режим отступа",
  "padding.paddingValues": "Значения отступов",
  "padding.oneValue": "Одно значение для всех сторон",
  "padding.horizontalVertical": "По горизонтали/вертикали",
  "padding.topRightBottomLeft": "Сверху/Справа/Снизу/Слева",

  // ── Typography ──
  "text.typography": "Типографика",
  "text.lineHeight": "Высота строки",
  "text.letterSpacing": "Межбуквенный интервал",
  "text.horizontal": "По горизонтали",
  "text.vertical": "По вертикали",
  "text.alignLeft": "По левому краю",
  "text.alignCenter": "По центру",
  "text.alignRight": "По правому краю",
  "text.justify": "По ширине",
  "text.top": "Сверху",
  "text.middle": "Посередине",
  "text.bottom": "Снизу",
  "text.weight.thin": "Тонкий",
  "text.weight.light": "Лёгкий",
  "text.weight.regular": "Обычный",
  "text.weight.medium": "Средний",
  "text.weight.semibold": "Полужирный",
  "text.weight.bold": "Жирный",
  "text.weight.black": "Сверхжирный",
  "text.font.search": "Поиск шрифтов\u2026",
  "text.font.bundled": "Встроенные",
  "text.font.system": "Системные",
  "text.font.loading": "Загрузка шрифтов\u2026",
  "text.font.noResults": "Шрифты не найдены",

  // ── Text Layout ──
  "textLayout.title": "Раскладка",
  "textLayout.dimensions": "Размеры",
  "textLayout.resizing": "Изменение размера",
  "textLayout.autoWidth": "Авто Ш",
  "textLayout.autoWidthDesc": "Авто ширина — текст расширяется горизонтально",
  "textLayout.autoHeight": "Авто В",
  "textLayout.autoHeightDesc":
    "Авто высота — фиксированная ширина, высота подстраивается",
  "textLayout.fixed": "Фикс.",
  "textLayout.fixedDesc":
    "Фиксированный размер — ширина и высота зафиксированы",
  "textLayout.fillWidth": "Заполнить ширину",
  "textLayout.fillHeight": "Заполнить высоту",

  // ── Effects ──
  "effects.title": "Эффекты",
  "effects.dropShadow": "Тень",
  "effects.blur": "Размытие",
  "effects.spread": "Распространение",
  "effects.color": "Цвет",

  // ── Export ──
  "export.title": "Экспорт",
  "export.format": "Формат",
  "export.scale": "Масштаб",
  "export.selectedOnly": "Экспортировать только выделенное",
  "export.exportFormat": "Экспорт {{format}}",
  "export.exportLayer": "Экспортировать слой",

  // ── Polygon ──
  "polygon.sides": "Стороны",

  // ── Ellipse ──
  "ellipse.start": "Начало",
  "ellipse.sweep": "Размах",
  "ellipse.innerRadius": "Внутр.",

  // ── Corner Radius ──
  "cornerRadius.title": "Радиус углов",

  // ── Size / Position ──
  "size.position": "Позиция",

  // ── Icon ──
  "icon.title": "Иконка",
  "icon.searchIcons": "Поиск иконок...",
  "icon.noIconsFound": "Иконки не найдены",
  "icon.typeToSearch": "Введите для поиска иконок Iconify",
  "icon.iconsCount": "{{count}} иконок",

  // ── Variables Panel ──
  "variables.addTheme": "Добавить тему",
  "variables.addVariant": "Добавить вариант",
  "variables.addVariable": "Добавить переменную",
  "variables.searchVariables": "Поиск переменных...",
  "variables.noMatch": "Нет переменных, соответствующих вашему запросу",
  "variables.noDefined": "Переменные не определены",
  "variables.closeShortcut": "Закрыть (\u2318\u21e7V)",
  "variables.presets": "Пресеты",
  "variables.savePreset": "Сохранить текущее как пресет…",
  "variables.loadPreset": "Загрузить пресет",
  "variables.importPreset": "Импорт из файла…",
  "variables.exportPreset": "Экспорт в файл…",
  "variables.presetName": "Название пресета",
  "variables.noPresets": "Нет сохранённых пресетов",

  // ── AI Chat ──
  "ai.newChat": "Новый чат",
  "ai.collapse": "Свернуть",
  "ai.tryExample":
    "\u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043a\u043e\u043c\u0430\u043d\u0434\u0443 \u0434\u043b\u044f \u0440\u0430\u0431\u043e\u0447\u0435\u0433\u043e \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u0430\u2026",
  "ai.tipSelectElements":
    "\u0421\u043e\u0432\u0435\u0442: \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u044b \u0432 \u0440\u0430\u0431\u043e\u0447\u0435\u043c \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u0435 \u043f\u0435\u0440\u0435\u0434 \u043d\u0430\u0447\u0430\u043b\u043e\u043c \u0447\u0430\u0442\u0430 \u0434\u043b\u044f \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u0430.",
  "ai.generating": "Генерация...",
  "ai.designWithAgent":
    "\u0421\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u0430\u0433\u0435\u043d\u0442\u0430 \u043e\u0431 \u044d\u0442\u043e\u043c \u0440\u0430\u0431\u043e\u0447\u0435\u043c \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u0435\u2026",
  "ai.attachImage": "Прикрепить изображение",
  "ai.stopGenerating": "Остановить генерацию",
  "ai.sendMessage": "Отправить сообщение",
  "ai.loadingModels": "Загрузка моделей...",
  "ai.noModelsConnected": "Нет подключённых моделей",
  "ai.quickAction.loginScreen": "Обобщить рабочее пространство",
  "ai.quickAction.loginScreenPrompt":
    "Обобщи текущее рабочее пространство и основные элементы, видимые в контексте документа.",
  "ai.quickAction.foodApp": "Описать выделение",
  "ai.quickAction.foodAppPrompt":
    "Опиши текущие выделенные элементы и любую важную структуру, которую замечаешь.",
  "ai.quickAction.bottomNav": "Предложить следующие шаги",
  "ai.quickAction.bottomNavPrompt":
    "На основе текущего рабочего пространства предложи три конкретных следующих шага.",
  "ai.quickAction.colorPalette": "Объяснить доступных агентов",
  "ai.quickAction.colorPalettePrompt":
    "Объясни, какие подключенные агенты и инструменты MCP сейчас доступны и как они могут помочь в этом рабочем пространстве.",

  // ── Code Panel ──
  "code.reactTailwind": "React + Tailwind",
  "code.htmlCss": "HTML + CSS",
  "code.cssVariables": "CSS Variables",
  "code.copyClipboard": "Копировать в буфер обмена",
  "code.copied": "Скопировано!",
  "code.download": "Скачать файл с кодом",
  "code.closeCodePanel": "Закрыть панель кода",
  "code.genCssVars": "Генерация CSS-переменных для всего документа",
  "code.genSelected": "Генерация кода для {{count}} выделенных элементов",
  "code.genDocument": "Генерация кода для всего документа",
  "code.aiEnhance": "Улучшить с ИИ",
  "code.cancelEnhance": "Отменить улучшение",
  "code.resetEnhance": "Сбросить",
  "code.enhancing": "ИИ улучшает код...",
  "code.enhanced": "Улучшено ИИ",

  // ── Save Dialog ──
  "save.saveAs": "Сохранить как",
  "save.fileName": "Имя файла",

  // ── Agent Settings ──
  "agents.title": "Настройка агентов и MCP",
  "agents.agentsOnCanvas": "Агенты на холсте",
  "agents.mcpIntegrations": "Интеграции MCP в терминале",
  "agents.transport": "Транспорт",
  "agents.port": "Порт",
  "agents.mcpRestart":
    "Интеграции MCP вступят в силу после перезапуска терминала.",
  "agents.modelCount": "{{count}} модель(ей)",
  "agents.connectionFailed": "Ошибка подключения",
  "agents.serverError": "Ошибка сервера {{status}}",
  "agents.failedTo": "Не удалось выполнить {{action}}",
  "agents.failedToMcp": "Не удалось {{action}} сервер MCP",
  "agents.failedTransport": "Не удалось обновить транспорт",
  "agents.failedMcpTransport": "Не удалось обновить транспорт MCP",
  "agents.claudeCode": "Claude Code",
  "agents.claudeModels": "Модели Claude",
  "agents.codexCli": "Codex CLI",
  "agents.openaiModels": "Модели OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ провайдеров LLM",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "Модели GitHub Copilot",
  "agents.mcpServer": "MCP Сервер",
  "agents.mcpServerStart": "Запустить",
  "agents.mcpServerStop": "Остановить",
  "agents.mcpServerRunning": "Работает",
  "agents.mcpServerStopped": "Остановлен",
  "agents.mcpLanAccess": "Доступ по LAN",
  "agents.mcpClientConfig": "Конфиг клиента",
  "agents.stdio": "stdio",
  "agents.http": "http",
  "agents.stdioHttp": "stdio + http",
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

  // ── Figma Import ──
  "figma.title": "Импорт из Figma",
  "figma.dropFile": "Перетащите файл .fig сюда",
  "figma.orBrowse": "или нажмите для выбора",
  "figma.exportTip":
    "Экспорт из Figma: Файл \u2192 Сохранить локальную копию (.fig)",
  "figma.selectFigFile": "Пожалуйста, выберите файл .fig",
  "figma.noPages": "В файле .fig не найдено страниц",
  "figma.parseFailed": "Не удалось разобрать файл .fig",
  "figma.convertFailed": "Не удалось конвертировать файл Figma",
  "figma.parsing": "Разбор файла .fig...",
  "figma.converting": "Конвертация узлов...",
  "figma.selectPage":
    "В этом файле {{count}} страниц. Выберите, какие импортировать:",
  "figma.layers": "{{count}} слоёв",
  "figma.importAll": "Импортировать все страницы",
  "figma.importComplete": "Импорт завершён!",
  "figma.moreWarnings": "...и ещё {{count}} предупреждений",
  "figma.tryAgain": "Попробовать снова",
  "figma.layoutMode": "Режим раскладки:",
  "figma.preserveLayout": "Сохранить раскладку Figma",
  "figma.autoLayout": "Авто-раскладка OpenPencil",
  "figma.comingSoon": "Скоро",

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Страница не найдена",

  // ── Component Browser ──
  "componentBrowser.title": "Браузер UIKit",
  "componentBrowser.exportKit": "Экспорт набора",
  "componentBrowser.importKit": "Импорт набора",
  "componentBrowser.kit": "Набор:",
  "componentBrowser.all": "Все",
  "componentBrowser.imported": "(импортирован)",
  "componentBrowser.components": "компоненты",
  "componentBrowser.searchComponents": "Поиск компонентов...",
  "componentBrowser.deleteKit": "Удалить {{name}}",
  "componentBrowser.category.all": "Все",
  "componentBrowser.category.buttons": "Кнопки",
  "componentBrowser.category.inputs": "Поля ввода",
  "componentBrowser.category.cards": "Карточки",
  "componentBrowser.category.nav": "Навигация",
  "componentBrowser.category.layout": "Раскладка",
  "componentBrowser.category.feedback": "Обратная связь",
  "componentBrowser.category.data": "Данные",
  "componentBrowser.category.other": "Прочее",

  // ── Variable Picker ──
  "variablePicker.boundTo": "Привязано к --{{name}}",
  "variablePicker.bindToVariable": "Привязать к переменной",
  "variablePicker.unbind": "Отвязать переменную",
  "variablePicker.noVariables": "Нет переменных типа {{type}}",
} as const;

export default ru;
