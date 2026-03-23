import type { TranslationKeys } from "./en";

const es: TranslationKeys = {
  // ── Common ──
  "common.rename": "Renombrar",
  "common.duplicate": "Duplicar",
  "common.delete": "Eliminar",
  "common.cancel": "Cancelar",
  "common.save": "Guardar",
  "common.close": "Cerrar",
  "common.connect": "Conectar",
  "common.disconnect": "Desconectar",
  "common.import": "Importar",
  "common.export": "Exportar",
  "common.name": "Nombre",
  "common.untitled": "Sin título",
  "common.best": "Recomendado",
  "common.selected": "{{count}} seleccionado(s)",

  // ── Toolbar ──
  "toolbar.select": "Selección",
  "toolbar.text": "Texto",
  "toolbar.frame": "Marco",
  "toolbar.hand": "Mano",
  "toolbar.undo": "Deshacer",
  "toolbar.redo": "Rehacer",
  "toolbar.variables": "Variables",
  "toolbar.uikitBrowser": "Explorador UIKit",

  // ── Shapes ──
  "shapes.rectangle": "Rectángulo",
  "shapes.ellipse": "Elipse",
  "shapes.polygon": "Polígono",
  "shapes.line": "Línea",
  "shapes.icon": "Icono",
  "shapes.importImageSvg": "Importar imagen o SVG\u2026",
  "shapes.pen": "Pluma",
  "shapes.shapeTools": "Herramientas de forma",
  "shapes.moreShapeTools": "Más herramientas de forma",

  // ── Top Bar ──
  "topbar.hideLayers": "Ocultar esquema",
  "topbar.showLayers": "Mostrar esquema",
  "topbar.new": "Nuevo",
  "topbar.open": "Abrir",
  "topbar.save": "Guardar",
  "topbar.importFigma": "Importar Figma",
  "topbar.codePanel": "Código",
  "topbar.fullscreen": "Pantalla completa",
  "topbar.exitFullscreen": "Salir de pantalla completa",
  "topbar.newAnalysis": "Nuevo an\u00e1lisis",
  "topbar.unsavedFile": "Archivo .gta sin guardar",
  "topbar.complete": "Completo",
  "topbar.incomplete": "{{count}} celdas restantes",
  "topbar.issues": "{{count}} problema(s)",
  "topbar.tooltipNew": "Iniciar un nuevo an\u00e1lisis",
  "topbar.tooltipOpen": "Abrir un an\u00e1lisis .gta guardado",
  "topbar.tooltipSave": "Guardar el an\u00e1lisis actual",
  "topbar.edited": "— Editado",
  "topbar.agentsAndMcp": "Agentes y MCP",
  "topbar.setupAgentsMcp": "Configurar Agentes y MCP",
  "topbar.connected": "conectado",
  "topbar.agentStatus": "{{agents}} agente{{agentSuffix}} · {{mcp}} MCP",

  // ── Right Panel ──
  "rightPanel.design": "Detalles",
  "rightPanel.code": "Código",
  "rightPanel.noSelection": "Seleccionar un elemento",

  // ── Pages ──
  "pages.title": "Páginas",
  "pages.addPage": "Agregar página",
  "pages.moveUp": "Mover arriba",
  "pages.moveDown": "Mover abajo",

  // ── Status Bar ──
  "statusbar.zoomOut": "Alejar",
  "statusbar.zoomIn": "Acercar",
  "statusbar.resetZoom": "Restablecer zoom",

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
  "layers.title": "Esquema",
  "layers.empty":
    "A\u00fan no hay elementos. Use la barra de herramientas para empezar.",

  // ── Layer Context Menu ──
  "layerMenu.groupSelection": "Agrupar selección",
  "layerMenu.createComponent": "Crear componente",
  "layerMenu.detachComponent": "Separar componente",
  "layerMenu.detachInstance": "Separar instancia",
  "layerMenu.booleanUnion": "Unión",
  "layerMenu.booleanSubtract": "Restar",
  "layerMenu.booleanIntersect": "Intersección",
  "layerMenu.toggleLock": "Alternar bloqueo",
  "layerMenu.toggleVisibility": "Alternar visibilidad",

  // ── Property Panel ──
  "property.createComponent": "Crear componente",
  "property.detachComponent": "Separar componente",
  "property.goToComponent": "Ir al componente",
  "property.detachInstance": "Separar instancia",

  // ── Fill ──
  "fill.title": "Relleno",
  "fill.solid": "Sólido",
  "fill.linear": "Lineal",
  "fill.radial": "Radial",
  "fill.image": "Imagen",
  "fill.stops": "Paradas",
  "fill.angle": "Ángulo",

  // ── Image ──
  "image.title": "Imagen",
  "image.fit": "Modo de ajuste",
  "image.fill": "Rellenar",
  "image.fitMode": "Ajustar",
  "image.crop": "Recortar",
  "image.tile": "Mosaico",
  "image.clickToUpload": "Haz clic para subir",
  "image.changeImage": "Cambiar imagen",
  "image.adjustments": "Ajustes",
  "image.exposure": "Exposición",
  "image.contrast": "Contraste",
  "image.saturation": "Saturación",
  "image.temperature": "Temperatura",
  "image.tint": "Tinte",
  "image.highlights": "Luces",
  "image.shadows": "Sombras",
  "image.reset": "Restablecer",

  // ── Stroke ──
  "stroke.title": "Trazo",

  // ── Appearance ──
  "appearance.layer": "Capa",
  "appearance.opacity": "Opacidad",

  // ── Layout ──
  "layout.flexLayout": "Diseño Flex",
  "layout.freedom": "Libre (sin diseño)",
  "layout.vertical": "Diseño vertical",
  "layout.horizontal": "Diseño horizontal",
  "layout.alignment": "Alineación",
  "layout.gap": "Espacio",
  "layout.spaceBetween": "Espacio entre",
  "layout.spaceAround": "Espacio alrededor",
  "layout.dimensions": "Dimensiones",
  "layout.fillWidth": "Rellenar ancho",
  "layout.fillHeight": "Rellenar alto",
  "layout.hugWidth": "Ajustar ancho",
  "layout.hugHeight": "Ajustar alto",
  "layout.clipContent": "Recortar contenido",

  // ── Padding ──
  "padding.title": "Relleno interior",
  "padding.paddingMode": "Modo de relleno interior",
  "padding.paddingValues": "Valores de relleno interior",
  "padding.oneValue": "Un valor para todos los lados",
  "padding.horizontalVertical": "Horizontal/Vertical",
  "padding.topRightBottomLeft": "Arriba/Derecha/Abajo/Izquierda",

  // ── Typography ──
  "text.typography": "Tipografía",
  "text.lineHeight": "Interlineado",
  "text.letterSpacing": "Espaciado entre letras",
  "text.horizontal": "Horizontal",
  "text.vertical": "Vertical",
  "text.alignLeft": "Alinear a la izquierda",
  "text.alignCenter": "Centrar",
  "text.alignRight": "Alinear a la derecha",
  "text.justify": "Justificar",
  "text.top": "Arriba",
  "text.middle": "Medio",
  "text.bottom": "Abajo",
  "text.weight.thin": "Thin",
  "text.weight.light": "Light",
  "text.weight.regular": "Regular",
  "text.weight.medium": "Medium",
  "text.weight.semibold": "Semibold",
  "text.weight.bold": "Bold",
  "text.weight.black": "Black",
  "text.font.search": "Buscar fuentes\u2026",
  "text.font.bundled": "Incluidas",
  "text.font.system": "Sistema",
  "text.font.loading": "Cargando fuentes\u2026",
  "text.font.noResults": "No se encontraron fuentes",

  // ── Text Layout ──
  "textLayout.title": "Diseño",
  "textLayout.dimensions": "Dimensiones",
  "textLayout.resizing": "Redimensionamiento",
  "textLayout.autoWidth": "Auto W",
  "textLayout.autoWidthDesc":
    "Ancho automático — el texto se expande horizontalmente",
  "textLayout.autoHeight": "Auto H",
  "textLayout.autoHeightDesc":
    "Alto automático — ancho fijo, alto autoajustable",
  "textLayout.fixed": "Fijo",
  "textLayout.fixedDesc": "Tamaño fijo — tanto el ancho como el alto son fijos",
  "textLayout.fillWidth": "Rellenar ancho",
  "textLayout.fillHeight": "Rellenar alto",

  // ── Effects ──
  "effects.title": "Efectos",
  "effects.dropShadow": "Sombra",
  "effects.blur": "Desenfoque",
  "effects.spread": "Extensión",
  "effects.color": "Color",

  // ── Export ──
  "export.title": "Exportar",
  "export.format": "Formato",
  "export.scale": "Escala",
  "export.selectedOnly": "Exportar solo la selección",
  "export.exportFormat": "Exportar {{format}}",
  "export.exportLayer": "Exportar capa",

  // ── Polygon ──
  "polygon.sides": "Lados",

  // ── Ellipse ──
  "ellipse.start": "Inicio",
  "ellipse.sweep": "Barrido",
  "ellipse.innerRadius": "Interior",

  // ── Corner Radius ──
  "cornerRadius.title": "Radio de esquina",

  // ── Size / Position ──
  "size.position": "Posición",

  // ── Icon ──
  "icon.title": "Icono",
  "icon.searchIcons": "Buscar iconos...",
  "icon.noIconsFound": "No se encontraron iconos",
  "icon.typeToSearch": "Escriba para buscar iconos de Iconify",
  "icon.iconsCount": "{{count}} iconos",

  // ── Variables Panel ──
  "variables.addTheme": "Agregar tema",
  "variables.addVariant": "Agregar variante",
  "variables.addVariable": "Agregar variable",
  "variables.searchVariables": "Buscar variables...",
  "variables.noMatch": "Ninguna variable coincide con su búsqueda",
  "variables.noDefined": "No hay variables definidas",
  "variables.closeShortcut": "Cerrar (⌘⇧V)",
  "variables.presets": "Preajustes",
  "variables.savePreset": "Guardar actual como preajuste…",
  "variables.loadPreset": "Cargar preajuste",
  "variables.importPreset": "Importar desde archivo…",
  "variables.exportPreset": "Exportar a archivo…",
  "variables.presetName": "Nombre del preajuste",
  "variables.noPresets": "No hay preajustes guardados",

  // ── AI Chat ──
  "ai.newChat": "Nueva conversación",
  "ai.collapse": "Contraer",
  "ai.tryExample": "Pruebe un comando del espacio de trabajo\u2026",
  "ai.tipSelectElements":
    "Consejo: seleccione elementos en el espacio de trabajo antes de chatear para dar contexto.",
  "ai.generating": "Generando...",
  "ai.designWithAgent":
    "Pregunte a un agente sobre este espacio de trabajo\u2026",
  "ai.attachImage": "Adjuntar imagen",
  "ai.stopGenerating": "Detener generación",
  "ai.sendMessage": "Enviar mensaje",
  "ai.loadingModels": "Cargando modelos...",
  "ai.noModelsConnected": "Sin modelos conectados",
  "ai.quickAction.loginScreen": "Resumir este espacio de trabajo",
  "ai.quickAction.loginScreenPrompt":
    "Resume el espacio de trabajo actual y los elementos principales visibles en el contexto del documento.",
  "ai.quickAction.foodApp": "Describir la selecci\u00f3n",
  "ai.quickAction.foodAppPrompt":
    "Describe los elementos actualmente seleccionados y cualquier estructura importante que notes.",
  "ai.quickAction.bottomNav": "Sugerir pr\u00f3ximos pasos",
  "ai.quickAction.bottomNavPrompt":
    "Basado en el espacio de trabajo actual, sugiere tres pr\u00f3ximos pasos concretos.",
  "ai.quickAction.colorPalette": "Explicar agentes disponibles",
  "ai.quickAction.colorPalettePrompt":
    "Explica qu\u00e9 agentes conectados y herramientas MCP est\u00e1n disponibles ahora y c\u00f3mo podr\u00edan ayudar en este espacio de trabajo.",

  // ── Code Panel ──
  "code.reactTailwind": "React + Tailwind",
  "code.htmlCss": "HTML + CSS",
  "code.cssVariables": "CSS Variables",
  "code.copyClipboard": "Copiar al portapapeles",
  "code.copied": "¡Copiado!",
  "code.download": "Descargar archivo de código",
  "code.closeCodePanel": "Cerrar panel de código",
  "code.genCssVars": "Generando variables CSS para todo el documento",
  "code.genSelected":
    "Generando código para {{count}} elemento(s) seleccionado(s)",
  "code.genDocument": "Generando código para todo el documento",
  "code.aiEnhance": "Mejorar con IA",
  "code.cancelEnhance": "Cancelar mejora",
  "code.resetEnhance": "Restablecer original",
  "code.enhancing": "La IA está mejorando el código...",
  "code.enhanced": "Mejorado por IA",

  // ── Save Dialog ──
  "save.saveAs": "Guardar como",
  "save.fileName": "Nombre del archivo",

  // ── Agent Settings ──
  "agents.title": "Configurar Agentes y MCP",
  "agents.agentsOnCanvas": "Agentes en el lienzo",
  "agents.mcpIntegrations": "Integraciones MCP en terminal",
  "agents.transport": "Transporte",
  "agents.port": "Puerto",
  "agents.mcpRestart":
    "Las integraciones MCP se aplicarán tras reiniciar la terminal.",
  "agents.modelCount": "{{count}} modelo(s)",
  "agents.connectionFailed": "Error de conexión",
  "agents.serverError": "Error del servidor {{status}}",
  "agents.failedTo": "Error al {{action}}",
  "agents.failedToMcp": "Error al {{action}} del servidor MCP",
  "agents.failedTransport": "Error al actualizar el transporte",
  "agents.failedMcpTransport": "Error al actualizar el transporte MCP",
  "agents.claudeCode": "Claude Code",
  "agents.claudeModels": "Modelos Claude",
  "agents.codexCli": "Codex CLI",
  "agents.openaiModels": "Modelos OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ proveedores LLM",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "Modelos GitHub Copilot",
  "agents.mcpServer": "Servidor MCP",
  "agents.mcpServerStart": "Iniciar",
  "agents.mcpServerStop": "Detener",
  "agents.mcpServerRunning": "En ejecución",
  "agents.mcpServerStopped": "Detenido",
  "agents.mcpLanAccess": "Acceso LAN",
  "agents.mcpClientConfig": "Config. del cliente",
  "agents.stdio": "stdio",
  "agents.http": "http",
  "agents.stdioHttp": "stdio + http",
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

  // ── Figma Import ──
  "figma.title": "Importar desde Figma",
  "figma.dropFile": "Suelte un archivo .fig aquí",
  "figma.orBrowse": "o haga clic para explorar",
  "figma.exportTip":
    "Exportar desde Figma: Archivo \u2192 Guardar copia local (.fig)",
  "figma.selectFigFile": "Seleccione un archivo .fig",
  "figma.noPages": "No se encontraron páginas en el archivo .fig",
  "figma.parseFailed": "Error al analizar el archivo .fig",
  "figma.convertFailed": "Error al convertir el archivo de Figma",
  "figma.parsing": "Analizando archivo .fig...",
  "figma.converting": "Convirtiendo nodos...",
  "figma.selectPage":
    "Este archivo tiene {{count}} páginas. Seleccione cuáles importar:",
  "figma.layers": "{{count}} capas",
  "figma.importAll": "Importar todas las páginas",
  "figma.importComplete": "¡Importación completa!",
  "figma.moreWarnings": "...y {{count}} advertencias más",
  "figma.tryAgain": "Intentar de nuevo",
  "figma.layoutMode": "Modo de diseño:",
  "figma.preserveLayout": "Conservar diseño de Figma",
  "figma.autoLayout": "Diseño automático OpenPencil",
  "figma.comingSoon": "Próximamente",

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Página no encontrada",

  // ── Component Browser ──
  "componentBrowser.title": "Explorador UIKit",
  "componentBrowser.exportKit": "Exportar kit",
  "componentBrowser.importKit": "Importar kit",
  "componentBrowser.kit": "Kit:",
  "componentBrowser.all": "Todos",
  "componentBrowser.imported": "(importado)",
  "componentBrowser.components": "componentes",
  "componentBrowser.searchComponents": "Buscar componentes...",
  "componentBrowser.deleteKit": "Eliminar {{name}}",
  "componentBrowser.category.all": "Todos",
  "componentBrowser.category.buttons": "Botones",
  "componentBrowser.category.inputs": "Entradas",
  "componentBrowser.category.cards": "Tarjetas",
  "componentBrowser.category.nav": "Navegación",
  "componentBrowser.category.layout": "Diseño",
  "componentBrowser.category.data": "Datos",
  "componentBrowser.category.feedback": "Retroalimentación",
  "componentBrowser.category.other": "Otro",

  // ── Variable Picker ──
  "variablePicker.boundTo": "Vinculado a --{{name}}",
  "variablePicker.bindToVariable": "Vincular a variable",
  "variablePicker.unbind": "Desvincular variable",
  "variablePicker.noVariables": "No hay variables {{type}} definidas",

  // ── Analysis ──
  "analysis.title": "Analista de Teoría de Juegos",
  "analysis.emptyState":
    "Soy su analista de teoría de juegos. ¿Qué evento desea analizar?",
  "analysis.emptyHint":
    "Identificaré jugadores, estrategias y estructura del juego automáticamente.",
  "analysis.inputPlaceholder": "Describa un evento para analizar...",
  "analysis.startingAnalysis":
    'Iniciando análisis teórico-estratégico de "{{topic}}"...',
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

  // ── Analysis Failures ──
  "analysis.failure.timeout": "tiempo agotado",
  "analysis.failure.parseError": "error de análisis sintáctico",
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
  "analysis.entities.noMatching": "No hay entidades coincidentes",
  "analysis.entities.searchHint":
    "Pruebe un término de búsqueda diferente o elimine el filtro de tipo.",
  "analysis.entities.confidence.high": "Alta",
  "analysis.entities.confidence.medium": "Media",
  "analysis.entities.confidence.low": "Baja",
  "analysis.entities.source.ai": "IA",
  "analysis.entities.source.human": "Humano",
  "analysis.entities.source.computed": "Calculado",
} as const;

export default es;
