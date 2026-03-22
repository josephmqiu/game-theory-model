import type { TranslationKeys } from "./en";

const pt: TranslationKeys = {
  // ── Common ──
  "common.rename": "Renomear",
  "common.duplicate": "Duplicar",
  "common.delete": "Excluir",
  "common.cancel": "Cancelar",
  "common.save": "Salvar",
  "common.close": "Fechar",
  "common.connect": "Conectar",
  "common.disconnect": "Desconectar",
  "common.import": "Importar",
  "common.export": "Exportar",
  "common.name": "Nome",
  "common.untitled": "Sem título",
  "common.best": "Melhor",
  "common.selected": "{{count}} selecionado(s)",

  // ── Toolbar ──
  "toolbar.select": "Selecionar",
  "toolbar.text": "Texto",
  "toolbar.frame": "Moldura",
  "toolbar.hand": "Mão",
  "toolbar.undo": "Desfazer",
  "toolbar.redo": "Refazer",
  "toolbar.variables": "Variáveis",
  "toolbar.uikitBrowser": "Navegador UIKit",

  // ── Shapes ──
  "shapes.rectangle": "Retângulo",
  "shapes.ellipse": "Elipse",
  "shapes.polygon": "Polígono",
  "shapes.line": "Linha",
  "shapes.icon": "Ícone",
  "shapes.importImageSvg": "Importar imagem ou SVG\u2026",
  "shapes.pen": "Caneta",
  "shapes.shapeTools": "Ferramentas de forma",
  "shapes.moreShapeTools": "Mais ferramentas de forma",

  // ── Top Bar ──
  "topbar.hideLayers": "Ocultar estrutura",
  "topbar.showLayers": "Mostrar estrutura",
  "topbar.new": "Novo",
  "topbar.open": "Abrir",
  "topbar.save": "Salvar",
  "topbar.importFigma": "Importar Figma",
  "topbar.codePanel": "Código",
  "topbar.fullscreen": "Tela cheia",
  "topbar.exitFullscreen": "Sair da tela cheia",
  "topbar.newAnalysis": "Nova an\u00e1lise",
  "topbar.unsavedFile": "Arquivo .gta n\u00e3o salvo",
  "topbar.complete": "Completo",
  "topbar.incomplete": "{{count}} c\u00e9lulas restantes",
  "topbar.issues": "{{count}} problema(s)",
  "topbar.tooltipNew": "Iniciar uma nova an\u00e1lise",
  "topbar.tooltipOpen": "Abrir uma an\u00e1lise .gta salva",
  "topbar.tooltipSave": "Salvar a an\u00e1lise atual",
  "topbar.edited": "— Editado",
  "topbar.agentsAndMcp": "Agentes & MCP",
  "topbar.setupAgentsMcp": "Configurar Agentes & MCP",
  "topbar.connected": "conectado",
  "topbar.agentStatus": "{{agents}} agente{{agentSuffix}} · {{mcp}} MCP",

  // ── Right Panel ──
  "rightPanel.design": "Detalhes",
  "rightPanel.code": "Código",
  "rightPanel.noSelection": "Selecionar um item",

  // ── Pages ──
  "pages.title": "Páginas",
  "pages.addPage": "Adicionar página",
  "pages.moveUp": "Mover para cima",
  "pages.moveDown": "Mover para baixo",

  // ── Status Bar ──
  "statusbar.zoomOut": "Diminuir zoom",
  "statusbar.zoomIn": "Aumentar zoom",
  "statusbar.resetZoom": "Redefinir zoom",

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
  "layers.title": "Estrutura",
  "layers.empty":
    "Nenhum item ainda. Use a barra de ferramentas para come\u00e7ar.",

  // ── Layer Context Menu ──
  "layerMenu.groupSelection": "Agrupar seleção",
  "layerMenu.createComponent": "Criar componente",
  "layerMenu.detachComponent": "Desanexar componente",
  "layerMenu.detachInstance": "Desanexar instância",
  "layerMenu.booleanUnion": "União",
  "layerMenu.booleanSubtract": "Subtrair",
  "layerMenu.booleanIntersect": "Interseção",
  "layerMenu.toggleLock": "Alternar bloqueio",
  "layerMenu.toggleVisibility": "Alternar visibilidade",

  // ── Property Panel ──
  "property.createComponent": "Criar componente",
  "property.detachComponent": "Desanexar componente",
  "property.goToComponent": "Ir para componente",
  "property.detachInstance": "Desanexar instância",

  // ── Fill ──
  "fill.title": "Preenchimento",
  "fill.solid": "Sólido",
  "fill.linear": "Linear",
  "fill.radial": "Radial",
  "fill.image": "Imagem",
  "fill.stops": "Paradas",
  "fill.angle": "Ângulo",

  // ── Image ──
  "image.title": "Imagem",
  "image.fit": "Modo de ajuste",
  "image.fill": "Preencher",
  "image.fitMode": "Ajustar",
  "image.crop": "Recortar",
  "image.tile": "Ladrilho",
  "image.clickToUpload": "Clique para enviar",
  "image.changeImage": "Alterar imagem",
  "image.adjustments": "Ajustes",
  "image.exposure": "Exposição",
  "image.contrast": "Contraste",
  "image.saturation": "Saturação",
  "image.temperature": "Temperatura",
  "image.tint": "Matiz",
  "image.highlights": "Realces",
  "image.shadows": "Sombras",
  "image.reset": "Redefinir",

  // ── Stroke ──
  "stroke.title": "Contorno",

  // ── Appearance ──
  "appearance.layer": "Camada",
  "appearance.opacity": "Opacidade",

  // ── Layout ──
  "layout.flexLayout": "Layout Flex",
  "layout.freedom": "Livre (sem layout)",
  "layout.vertical": "Layout vertical",
  "layout.horizontal": "Layout horizontal",
  "layout.alignment": "Alinhamento",
  "layout.gap": "Espaçamento",
  "layout.spaceBetween": "Espaço entre",
  "layout.spaceAround": "Espaço ao redor",
  "layout.dimensions": "Dimensões",
  "layout.fillWidth": "Preencher largura",
  "layout.fillHeight": "Preencher altura",
  "layout.hugWidth": "Ajustar largura",
  "layout.hugHeight": "Ajustar altura",
  "layout.clipContent": "Recortar conteúdo",

  // ── Padding ──
  "padding.title": "Espaçamento interno",
  "padding.paddingMode": "Modo de espaçamento",
  "padding.paddingValues": "Valores de espaçamento",
  "padding.oneValue": "Um valor para todos os lados",
  "padding.horizontalVertical": "Horizontal/Vertical",
  "padding.topRightBottomLeft": "Cima/Direita/Baixo/Esquerda",

  // ── Typography ──
  "text.typography": "Tipografia",
  "text.lineHeight": "Altura da linha",
  "text.letterSpacing": "Espaçamento entre letras",
  "text.horizontal": "Horizontal",
  "text.vertical": "Vertical",
  "text.alignLeft": "Alinhar à esquerda",
  "text.alignCenter": "Centralizar",
  "text.alignRight": "Alinhar à direita",
  "text.justify": "Justificar",
  "text.top": "Topo",
  "text.middle": "Meio",
  "text.bottom": "Base",
  "text.weight.thin": "Fino",
  "text.weight.light": "Leve",
  "text.weight.regular": "Regular",
  "text.weight.medium": "Médio",
  "text.weight.semibold": "Seminegrito",
  "text.weight.bold": "Negrito",
  "text.weight.black": "Preto",
  "text.font.search": "Pesquisar fontes\u2026",
  "text.font.bundled": "Incluídas",
  "text.font.system": "Sistema",
  "text.font.loading": "Carregando fontes\u2026",
  "text.font.noResults": "Nenhuma fonte encontrada",

  // ── Text Layout ──
  "textLayout.title": "Layout",
  "textLayout.dimensions": "Dimensões",
  "textLayout.resizing": "Redimensionamento",
  "textLayout.autoWidth": "Auto L",
  "textLayout.autoWidthDesc":
    "Largura automática — texto expande horizontalmente",
  "textLayout.autoHeight": "Auto A",
  "textLayout.autoHeightDesc":
    "Altura automática — largura fixa, altura se ajusta",
  "textLayout.fixed": "Fixo",
  "textLayout.fixedDesc": "Tamanho fixo — largura e altura são fixas",
  "textLayout.fillWidth": "Preencher largura",
  "textLayout.fillHeight": "Preencher altura",

  // ── Effects ──
  "effects.title": "Efeitos",
  "effects.dropShadow": "Sombra projetada",
  "effects.blur": "Desfoque",
  "effects.spread": "Dispersão",
  "effects.color": "Cor",

  // ── Export ──
  "export.title": "Exportar",
  "export.format": "Formato",
  "export.scale": "Escala",
  "export.selectedOnly": "Exportar somente selecionados",
  "export.exportFormat": "Exportar {{format}}",
  "export.exportLayer": "Exportar camada",

  // ── Polygon ──
  "polygon.sides": "Lados",

  // ── Ellipse ──
  "ellipse.start": "Início",
  "ellipse.sweep": "Varredura",
  "ellipse.innerRadius": "Interior",

  // ── Corner Radius ──
  "cornerRadius.title": "Raio dos cantos",

  // ── Size / Position ──
  "size.position": "Posição",

  // ── Icon ──
  "icon.title": "Ícone",
  "icon.searchIcons": "Buscar ícones...",
  "icon.noIconsFound": "Nenhum ícone encontrado",
  "icon.typeToSearch": "Digite para buscar ícones Iconify",
  "icon.iconsCount": "{{count}} ícones",

  // ── Variables Panel ──
  "variables.addTheme": "Adicionar tema",
  "variables.addVariant": "Adicionar variante",
  "variables.addVariable": "Adicionar variável",
  "variables.searchVariables": "Buscar variáveis...",
  "variables.noMatch": "Nenhuma variável corresponde à sua busca",
  "variables.noDefined": "Nenhuma variável definida",
  "variables.closeShortcut": "Fechar (\u2318\u21e7V)",
  "variables.presets": "Predefinições",
  "variables.savePreset": "Salvar atual como predefinição…",
  "variables.loadPreset": "Carregar predefinição",
  "variables.importPreset": "Importar de arquivo…",
  "variables.exportPreset": "Exportar para arquivo…",
  "variables.presetName": "Nome da predefinição",
  "variables.noPresets": "Nenhuma predefinição salva",

  // ── AI Chat ──
  "ai.newChat": "Novo chat",
  "ai.collapse": "Recolher",
  "ai.tryExample": "Experimente um comando do espa\u00e7o de trabalho\u2026",
  "ai.tipSelectElements":
    "Dica: selecione itens no espa\u00e7o de trabalho antes de conversar para fornecer contexto.",
  "ai.generating": "Gerando...",
  "ai.designWithAgent":
    "Pergunte a um agente sobre este espa\u00e7o de trabalho\u2026",
  "ai.attachImage": "Anexar imagem",
  "ai.stopGenerating": "Parar geração",
  "ai.sendMessage": "Enviar mensagem",
  "ai.loadingModels": "Carregando modelos...",
  "ai.noModelsConnected": "Nenhum modelo conectado",
  "ai.quickAction.loginScreen": "Resumir este espa\u00e7o de trabalho",
  "ai.quickAction.loginScreenPrompt":
    "Resuma o espa\u00e7o de trabalho atual e os principais itens vis\u00edveis no contexto do documento.",
  "ai.quickAction.foodApp": "Descrever a sele\u00e7\u00e3o",
  "ai.quickAction.foodAppPrompt":
    "Descreva os itens atualmente selecionados e qualquer estrutura importante que voc\u00ea notar.",
  "ai.quickAction.bottomNav": "Sugerir pr\u00f3ximos passos",
  "ai.quickAction.bottomNavPrompt":
    "Com base no espa\u00e7o de trabalho atual, sugira tr\u00eas pr\u00f3ximos passos concretos.",
  "ai.quickAction.colorPalette": "Explicar agentes dispon\u00edveis",
  "ai.quickAction.colorPalettePrompt":
    "Explique quais agentes conectados e ferramentas MCP est\u00e3o dispon\u00edveis agora e como podem ajudar neste espa\u00e7o de trabalho.",

  // ── Code Panel ──
  "code.reactTailwind": "React + Tailwind",
  "code.htmlCss": "HTML + CSS",
  "code.cssVariables": "CSS Variables",
  "code.copyClipboard": "Copiar para a área de transferência",
  "code.copied": "Copiado!",
  "code.download": "Baixar arquivo de código",
  "code.closeCodePanel": "Fechar painel de código",
  "code.genCssVars": "Gerando variáveis CSS para o documento inteiro",
  "code.genSelected":
    "Gerando código para {{count}} elemento(s) selecionado(s)",
  "code.genDocument": "Gerando código para o documento inteiro",
  "code.aiEnhance": "Melhorar com IA",
  "code.cancelEnhance": "Cancelar melhoria",
  "code.resetEnhance": "Restaurar original",
  "code.enhancing": "A IA está melhorando o código...",
  "code.enhanced": "Melhorado por IA",

  // ── Save Dialog ──
  "save.saveAs": "Salvar como",
  "save.fileName": "Nome do arquivo",

  // ── Agent Settings ──
  "agents.title": "Configurar Agentes & MCP",
  "agents.agentsOnCanvas": "Agentes no Canvas",
  "agents.mcpIntegrations": "Integrações MCP no Terminal",
  "agents.transport": "Transporte",
  "agents.port": "Porta",
  "agents.mcpRestart":
    "As integrações MCP entrarão em vigor após reiniciar o terminal.",
  "agents.modelCount": "{{count}} modelo(s)",
  "agents.connectionFailed": "Falha na conexão",
  "agents.serverError": "Erro do servidor {{status}}",
  "agents.failedTo": "Falha ao {{action}}",
  "agents.failedToMcp": "Falha ao {{action}} servidor MCP",
  "agents.failedTransport": "Falha ao atualizar transporte",
  "agents.failedMcpTransport": "Falha ao atualizar transporte MCP",
  "agents.claudeCode": "Claude Code",
  "agents.claudeModels": "Modelos Claude",
  "agents.codexCli": "Codex CLI",
  "agents.openaiModels": "Modelos OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ provedores de LLM",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "Modelos GitHub Copilot",
  "agents.mcpServer": "Servidor MCP",
  "agents.mcpServerStart": "Iniciar",
  "agents.mcpServerStop": "Parar",
  "agents.mcpServerRunning": "Em execução",
  "agents.mcpServerStopped": "Parado",
  "agents.mcpLanAccess": "Acesso LAN",
  "agents.mcpClientConfig": "Config. do cliente",
  "agents.stdio": "stdio",
  "agents.http": "http",
  "agents.stdioHttp": "stdio + http",
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
  "figma.title": "Importar do Figma",
  "figma.dropFile": "Solte um arquivo .fig aqui",
  "figma.orBrowse": "ou clique para procurar",
  "figma.exportTip":
    "Exportar do Figma: Arquivo \u2192 Salvar cópia local (.fig)",
  "figma.selectFigFile": "Por favor, selecione um arquivo .fig",
  "figma.noPages": "Nenhuma página encontrada no arquivo .fig",
  "figma.parseFailed": "Falha ao analisar o arquivo .fig",
  "figma.convertFailed": "Falha ao converter o arquivo Figma",
  "figma.parsing": "Analisando arquivo .fig...",
  "figma.converting": "Convertendo nós...",
  "figma.selectPage":
    "Este arquivo tem {{count}} páginas. Selecione quais importar:",
  "figma.layers": "{{count}} camadas",
  "figma.importAll": "Importar todas as páginas",
  "figma.importComplete": "Importação concluída!",
  "figma.moreWarnings": "...e mais {{count}} avisos",
  "figma.tryAgain": "Tentar novamente",
  "figma.layoutMode": "Modo de layout:",
  "figma.preserveLayout": "Preservar layout do Figma",
  "figma.autoLayout": "Auto layout do OpenPencil",
  "figma.comingSoon": "Em breve",

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Página não encontrada",

  // ── Component Browser ──
  "componentBrowser.title": "Navegador UIKit",
  "componentBrowser.exportKit": "Exportar kit",
  "componentBrowser.importKit": "Importar kit",
  "componentBrowser.kit": "Kit:",
  "componentBrowser.all": "Todos",
  "componentBrowser.imported": "(importado)",
  "componentBrowser.components": "componentes",
  "componentBrowser.searchComponents": "Buscar componentes...",
  "componentBrowser.deleteKit": "Excluir {{name}}",
  "componentBrowser.category.all": "Todos",
  "componentBrowser.category.buttons": "Botões",
  "componentBrowser.category.inputs": "Campos",
  "componentBrowser.category.cards": "Cards",
  "componentBrowser.category.nav": "Navegação",
  "componentBrowser.category.layout": "Layout",
  "componentBrowser.category.feedback": "Feedback",
  "componentBrowser.category.data": "Dados",
  "componentBrowser.category.other": "Outros",

  // ── Variable Picker ──
  "variablePicker.boundTo": "Vinculado a --{{name}}",
  "variablePicker.bindToVariable": "Vincular a variável",
  "variablePicker.unbind": "Desvincular variável",
  "variablePicker.noVariables": "Nenhuma variável de {{type}} definida",

  // ── Analysis ──
  "analysis.title": "Analista de Teoria dos Jogos",
  "analysis.emptyState":
    "Sou seu analista de teoria dos jogos. Qual evento você deseja analisar?",
  "analysis.emptyHint":
    "Identificarei jogadores, estratégias e estrutura do jogo automaticamente.",
  "analysis.inputPlaceholder": "Descreva um evento para analisar...",
  "analysis.startingAnalysis":
    'Iniciando análise teórico-estratégica de "{{topic}}"...',
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
  "analysis.activity.agentProgress": "Progresso do agente",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Fase {{number}} falhou",
  "analysis.progress.phaseLabel": "Fase {{number}}: {{name}}",
  "analysis.progress.phasesComplete":
    "{{completed}}/{{total}} fases concluídas",
  "analysis.progress.entityCount": "{{count}} entidade",
  "analysis.progress.entityCountPlural": "{{count}} entidades",

  // ── Analysis Failures ──
  "analysis.failure.timeout": "tempo esgotado",
  "analysis.failure.parseError": "erro de análise sintática",
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
  "analysis.entities.noMatching": "Nenhuma entidade correspondente",
  "analysis.entities.searchHint":
    "Tente um termo de busca diferente ou remova o filtro de tipo.",
  "analysis.entities.confidence.high": "Alta",
  "analysis.entities.confidence.medium": "Média",
  "analysis.entities.confidence.low": "Baixa",
  "analysis.entities.source.ai": "IA",
  "analysis.entities.source.human": "Humano",
  "analysis.entities.source.computed": "Calculado",
} as const;

export default pt;
