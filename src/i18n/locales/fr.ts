import type { TranslationKeys } from './en'

const fr: TranslationKeys = {
  // ── Common ──
  'common.rename': 'Renommer',
  'common.duplicate': 'Dupliquer',
  'common.delete': 'Supprimer',
  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.close': 'Fermer',
  'common.connect': 'Connecter',
  'common.disconnect': 'Déconnecter',
  'common.import': 'Importer',
  'common.export': 'Exporter',
  'common.name': 'Nom',
  'common.untitled': 'Sans titre',
  'common.best': 'Recommandé',
  'common.selected': '{{count}} sélectionné(s)',

  // ── Toolbar ──
  'toolbar.select': 'Sélection',
  'toolbar.text': 'Texte',
  'toolbar.frame': 'Cadre',
  'toolbar.hand': 'Main',
  'toolbar.undo': 'Annuler',
  'toolbar.redo': 'Rétablir',
  'toolbar.variables': 'Variables',
  'toolbar.uikitBrowser': 'Navigateur UIKit',

  // ── Shapes ──
  'shapes.rectangle': 'Rectangle',
  'shapes.ellipse': 'Ellipse',
  'shapes.polygon': 'Polygone',
  'shapes.line': 'Ligne',
  'shapes.icon': 'Icône',
  'shapes.importImageSvg': 'Importer une image ou un SVG\u2026',
  'shapes.pen': 'Plume',
  'shapes.shapeTools': 'Outils de forme',
  'shapes.moreShapeTools': 'Plus d\u2019outils de forme',

  // ── Top Bar ──
  'topbar.hideLayers': 'Hide outline',
  'topbar.showLayers': 'Show outline',
  'topbar.new': 'Nouveau',
  'topbar.open': 'Ouvrir',
  'topbar.save': 'Enregistrer',
  'topbar.importFigma': 'Importer Figma',
  'topbar.codePanel': 'Code',
  'topbar.lightMode': 'Mode clair',
  'topbar.darkMode': 'Mode sombre',
  'topbar.fullscreen': 'Plein écran',
  'topbar.exitFullscreen': 'Quitter le plein écran',
  'topbar.newAnalysis': 'New Analysis',
  'topbar.unsavedFile': 'Unsaved .gta file',
  'topbar.complete': 'Complete',
  'topbar.incomplete': '{{count}} incomplete',
  'topbar.issues': '{{count}} issue(s)',
  'topbar.tooltipNew': 'Start a fresh analysis',
  'topbar.tooltipOpen': 'Open a saved .gta analysis',
  'topbar.tooltipSave': 'Save the current analysis',
  'topbar.edited': '— Modifié',
  'topbar.agentsAndMcp': 'Agents & MCP',
  'topbar.setupAgentsMcp': 'Configurer Agents & MCP',
  'topbar.connected': 'connecté',
  'topbar.agentStatus': '{{agents}} agent{{agentSuffix}} · {{mcp}} MCP',

  // ── Right Panel ──
  'rightPanel.design': 'Details',
  'rightPanel.code': 'Code',
  'rightPanel.noSelection': 'Select an item',

  // ── Pages ──
  'pages.title': 'Pages',
  'pages.addPage': 'Ajouter une page',
  'pages.moveUp': 'Monter',
  'pages.moveDown': 'Descendre',

  // ── Status Bar ──
  'statusbar.zoomOut': 'Dézoomer',
  'statusbar.zoomIn': 'Zoomer',
  'statusbar.resetZoom': 'Réinitialiser le zoom',

  // ── Updater ──
  'updater.softwareUpdate': 'Mise à jour logicielle',
  'updater.dismiss': 'Ignorer',
  'updater.current': 'Actuelle',
  'updater.latest': 'Dernière',
  'updater.unknown': 'Inconnue',
  'updater.checking': 'Vérification...',
  'updater.downloadProgress': 'Progression du téléchargement',
  'updater.checkAgain': 'Vérifier à nouveau',
  'updater.restartInstall': 'Redémarrer et installer',
  'updater.installing': 'Installation...',
  'updater.releaseDate': 'Date de publication : {{date}}',
  'updater.restartHint':
    'Redémarrez pour appliquer la mise à jour. Le redémarrage prend généralement 10 à 15 secondes.',
  'updater.unknownError': 'Erreur de mise à jour inconnue.',
  'updater.title.checking': 'Recherche de mises à jour',
  'updater.title.available': 'Mise à jour disponible',
  'updater.title.downloading': 'Téléchargement de la mise à jour',
  'updater.title.downloaded': 'Prêt à installer',
  'updater.title.error': 'Échec de la mise à jour',
  'updater.subtitle.checking': 'Recherche de la dernière version...',
  'updater.subtitle.available': 'La version {{version}} est disponible.',
  'updater.subtitle.availableGeneric': 'Une nouvelle version est disponible.',
  'updater.subtitle.downloading':
    'La version {{version}} est en cours de téléchargement en arrière-plan.',
  'updater.subtitle.downloadingGeneric':
    'Téléchargement du paquet de mise à jour en arrière-plan.',
  'updater.subtitle.downloaded': 'La version {{version}} a été téléchargée.',
  'updater.subtitle.downloadedGeneric': 'La mise à jour a été téléchargée.',
  'updater.subtitle.error':
    'Impossible de vérifier ou de télécharger la mise à jour.',

  // ── Layers ──
  'layers.title': 'Outline',
  'layers.empty':
    'No items yet. Use the toolbar to start building.',

  // ── Layer Context Menu ──
  'layerMenu.groupSelection': 'Grouper la sélection',
  'layerMenu.createComponent': 'Créer un composant',
  'layerMenu.detachComponent': 'Détacher le composant',
  'layerMenu.detachInstance': 'Détacher l\u2019instance',
  'layerMenu.booleanUnion': 'Union',
  'layerMenu.booleanSubtract': 'Soustraire',
  'layerMenu.booleanIntersect': 'Intersection',
  'layerMenu.toggleLock': 'Verrouiller / Déverrouiller',
  'layerMenu.toggleVisibility': 'Afficher / Masquer',

  // ── Property Panel ──
  'property.createComponent': 'Créer un composant',
  'property.detachComponent': 'Détacher le composant',
  'property.goToComponent': 'Aller au composant',
  'property.detachInstance': 'Détacher l\u2019instance',

  // ── Fill ──
  'fill.title': 'Remplissage',
  'fill.solid': 'Uni',
  'fill.linear': 'Linéaire',
  'fill.radial': 'Radial',
  'fill.image': 'Image',
  'fill.stops': 'Arrêts',
  'fill.angle': 'Angle',

  // ── Image ──
  'image.title': 'Image',
  'image.fit': "Mode d'ajustement",
  'image.fill': 'Remplir',
  'image.fitMode': 'Ajuster',
  'image.crop': 'Recadrer',
  'image.tile': 'Mosaïque',
  'image.clickToUpload': 'Cliquez pour télécharger',
  'image.changeImage': "Changer l'image",
  'image.adjustments': 'Réglages',
  'image.exposure': 'Exposition',
  'image.contrast': 'Contraste',
  'image.saturation': 'Saturation',
  'image.temperature': 'Température',
  'image.tint': 'Teinte',
  'image.highlights': 'Hautes lumières',
  'image.shadows': 'Ombres',
  'image.reset': 'Réinitialiser',

  // ── Stroke ──
  'stroke.title': 'Contour',

  // ── Appearance ──
  'appearance.layer': 'Calque',
  'appearance.opacity': 'Opacité',

  // ── Layout ──
  'layout.flexLayout': 'Mise en page Flex',
  'layout.freedom': 'Libre (sans mise en page)',
  'layout.vertical': 'Mise en page verticale',
  'layout.horizontal': 'Mise en page horizontale',
  'layout.alignment': 'Alignement',
  'layout.gap': 'Espacement',
  'layout.spaceBetween': 'Espace entre',
  'layout.spaceAround': 'Espace autour',
  'layout.dimensions': 'Dimensions',
  'layout.fillWidth': 'Remplir la largeur',
  'layout.fillHeight': 'Remplir la hauteur',
  'layout.hugWidth': 'Ajuster à la largeur',
  'layout.hugHeight': 'Ajuster à la hauteur',
  'layout.clipContent': 'Rogner le contenu',

  // ── Padding ──
  'padding.title': 'Marge intérieure',
  'padding.paddingMode': 'Mode de marge intérieure',
  'padding.paddingValues': 'Valeurs de marge intérieure',
  'padding.oneValue': 'Une valeur pour tous les côtés',
  'padding.horizontalVertical': 'Horizontal/Vertical',
  'padding.topRightBottomLeft': 'Haut/Droite/Bas/Gauche',

  // ── Typography ──
  'text.typography': 'Typographie',
  'text.lineHeight': 'Interligne',
  'text.letterSpacing': 'Espacement des lettres',
  'text.horizontal': 'Horizontal',
  'text.vertical': 'Vertical',
  'text.alignLeft': 'Aligner à gauche',
  'text.alignCenter': 'Centrer',
  'text.alignRight': 'Aligner à droite',
  'text.justify': 'Justifier',
  'text.top': 'Haut',
  'text.middle': 'Milieu',
  'text.bottom': 'Bas',
  'text.weight.thin': 'Thin',
  'text.weight.light': 'Light',
  'text.weight.regular': 'Regular',
  'text.weight.medium': 'Medium',
  'text.weight.semibold': 'Semibold',
  'text.weight.bold': 'Bold',
  'text.weight.black': 'Black',
  'text.font.search': 'Rechercher des polices\u2026',
  'text.font.bundled': 'Incluses',
  'text.font.system': 'Système',
  'text.font.loading': 'Chargement des polices\u2026',
  'text.font.noResults': 'Aucune police trouvée',

  // ── Text Layout ──
  'textLayout.title': 'Mise en page',
  'textLayout.dimensions': 'Dimensions',
  'textLayout.resizing': 'Redimensionnement',
  'textLayout.autoWidth': 'Auto W',
  'textLayout.autoWidthDesc':
    'Largeur automatique — le texte s\u2019étend horizontalement',
  'textLayout.autoHeight': 'Auto H',
  'textLayout.autoHeightDesc':
    'Hauteur automatique — largeur fixe, hauteur auto-ajustée',
  'textLayout.fixed': 'Fixe',
  'textLayout.fixedDesc':
    'Taille fixe — la largeur et la hauteur sont fixes',
  'textLayout.fillWidth': 'Remplir la largeur',
  'textLayout.fillHeight': 'Remplir la hauteur',

  // ── Effects ──
  'effects.title': 'Effets',
  'effects.dropShadow': 'Ombre portée',
  'effects.blur': 'Flou',
  'effects.spread': 'Étendue',
  'effects.color': 'Couleur',

  // ── Export ──
  'export.title': 'Exporter',
  'export.format': 'Format',
  'export.scale': 'Échelle',
  'export.selectedOnly': 'Exporter la sélection uniquement',
  'export.exportFormat': 'Exporter en {{format}}',
  'export.exportLayer': 'Exporter le calque',

  // ── Polygon ──
  'polygon.sides': 'Côtés',

  // ── Ellipse ──
  'ellipse.start': 'Début',
  'ellipse.sweep': 'Balayage',
  'ellipse.innerRadius': 'Intérieur',

  // ── Corner Radius ──
  'cornerRadius.title': 'Rayon de coin',

  // ── Size / Position ──
  'size.position': 'Position',

  // ── Icon ──
  'icon.title': 'Icône',
  'icon.searchIcons': 'Rechercher des icônes...',
  'icon.noIconsFound': 'Aucune icône trouvée',
  'icon.typeToSearch': 'Tapez pour rechercher des icônes Iconify',
  'icon.iconsCount': '{{count}} icônes',

  // ── Variables Panel ──
  'variables.addTheme': 'Ajouter un thème',
  'variables.addVariant': 'Ajouter une variante',
  'variables.addVariable': 'Ajouter une variable',
  'variables.searchVariables': 'Rechercher des variables...',
  'variables.noMatch': 'Aucune variable ne correspond à votre recherche',
  'variables.noDefined': 'Aucune variable définie',
  'variables.closeShortcut': 'Fermer (⌘⇧V)',
  'variables.presets': 'Préréglages',
  'variables.savePreset': 'Enregistrer comme préréglage…',
  'variables.loadPreset': 'Charger un préréglage',
  'variables.importPreset': 'Importer depuis un fichier…',
  'variables.exportPreset': 'Exporter vers un fichier…',
  'variables.presetName': 'Nom du préréglage',
  'variables.noPresets': 'Aucun préréglage enregistré',

  // ── AI Chat ──
  'ai.newChat': 'Nouvelle conversation',
  'ai.collapse': 'Réduire',
  'ai.tryExample': 'Try a workspace prompt...',
  'ai.tipSelectElements':
    'Tip: Select items in the workspace before chatting for context.',
  'ai.generating': 'Génération...',
  'ai.designWithAgent': 'Ask an agent about this workspace...',
  'ai.attachImage': 'Joindre une image',
  'ai.stopGenerating': 'Arrêter la génération',
  'ai.sendMessage': 'Envoyer le message',
  'ai.loadingModels': 'Chargement des modèles...',
  'ai.noModelsConnected': 'Aucun modèle connecté',
  'ai.quickAction.loginScreen': 'Summarize this workspace',
  'ai.quickAction.loginScreenPrompt':
    'Summarize the current workspace and the main items visible in the document context.',
  'ai.quickAction.foodApp': 'Describe the selection',
  'ai.quickAction.foodAppPrompt':
    'Describe the currently selected items and any important structure you notice.',
  'ai.quickAction.bottomNav': 'Suggest next steps',
  'ai.quickAction.bottomNavPrompt':
    'Based on the current workspace, suggest three concrete next steps.',
  'ai.quickAction.colorPalette':
    'Explain available agents',
  'ai.quickAction.colorPalettePrompt':
    'Explain which connected agents and MCP tools are available right now and how they could help in this workspace.',

  // ── Code Panel ──
  'code.reactTailwind': 'React + Tailwind',
  'code.htmlCss': 'HTML + CSS',
  'code.cssVariables': 'CSS Variables',
  'code.copyClipboard': 'Copier dans le presse-papiers',
  'code.copied': 'Copié !',
  'code.download': 'Télécharger le fichier de code',
  'code.closeCodePanel': 'Fermer le panneau de code',
  'code.genCssVars':
    'Génération des variables CSS pour l\u2019ensemble du document',
  'code.genSelected':
    'Génération du code pour {{count}} élément(s) sélectionné(s)',
  'code.genDocument': 'Génération du code pour l\u2019ensemble du document',
  'code.aiEnhance': 'Améliorer par IA',
  'code.cancelEnhance': 'Annuler l\u2019amélioration',
  'code.resetEnhance': 'Réinitialiser',
  'code.enhancing': 'L\u2019IA améliore le code...',
  'code.enhanced': 'Amélioré par IA',

  // ── Save Dialog ──
  'save.saveAs': 'Enregistrer sous',
  'save.fileName': 'Nom du fichier',

  // ── Agent Settings ──
  'agents.title': 'Configurer Agents & MCP',
  'agents.agentsOnCanvas': 'Agents sur le canevas',
  'agents.mcpIntegrations': 'Intégrations MCP dans le terminal',
  'agents.transport': 'Transport',
  'agents.port': 'Port',
  'agents.mcpRestart':
    'Les intégrations MCP prendront effet après le redémarrage du terminal.',
  'agents.modelCount': '{{count}} modèle(s)',
  'agents.connectionFailed': 'Échec de la connexion',
  'agents.serverError': 'Erreur serveur {{status}}',
  'agents.failedTo': 'Échec de {{action}}',
  'agents.failedToMcp': 'Échec de {{action}} du serveur MCP',
  'agents.failedTransport': 'Échec de la mise à jour du transport',
  'agents.failedMcpTransport': 'Échec de la mise à jour du transport MCP',
  'agents.claudeCode': 'Claude Code',
  'agents.claudeModels': 'Modèles Claude',
  'agents.codexCli': 'Codex CLI',
  'agents.openaiModels': 'Modèles OpenAI',
  'agents.opencode': 'OpenCode',
  'agents.opencodeDesc': '75+ fournisseurs LLM',
  'agents.copilot': 'GitHub Copilot',
  'agents.copilotDesc': 'Modèles GitHub Copilot',
  'agents.mcpServer': 'Serveur MCP',
  'agents.mcpServerStart': 'Démarrer',
  'agents.mcpServerStop': 'Arrêter',
  'agents.mcpServerRunning': 'En cours',
  'agents.mcpServerStopped': 'Arrêté',
  'agents.mcpLanAccess': 'Accès LAN',
  'agents.mcpClientConfig': 'Config. client',
  'agents.stdio': 'stdio',
  'agents.http': 'http',
  'agents.stdioHttp': 'stdio + http',
  'agents.autoUpdate': 'Vérifier les mises à jour automatiquement',
  'agents.notInstalled': 'Non installé',
  'agents.install': 'Installer',
  'agents.installing': 'Installation...',
  'agents.installFailed': "Échec de l'installation",
  'agents.viewDocs': 'Docs',
  'agents.analysisRuntime': 'Analysis Runtime',
  'agents.analysisWebSearch': 'Web search',
  'agents.analysisWebSearchHint':
    'Use live web research during analysis runs.',
  'agents.analysisEffort': 'Analysis effort',
  'agents.analysisEffortHint':
    'Controls analysis depth guidance for analysis runs, not model selection.',
  'agents.analysisEffortQuick': 'Quick',
  'agents.analysisEffortStandard': 'Standard',
  'agents.analysisEffortThorough': 'Thorough',
  'agents.analysisPhases': 'Phase selection',
  'agents.analysisPhasesHint':
    'Custom phase runs only the selected phases and may disable automatic downstream revalidation.',
  'agents.analysisPhasesAll': 'All phases',
  'agents.analysisPhasesCustom': 'Custom',

  // ── Figma Import ──
  'figma.title': 'Importer depuis Figma',
  'figma.dropFile': 'Déposez un fichier .fig ici',
  'figma.orBrowse': 'ou cliquez pour parcourir',
  'figma.exportTip':
    'Exporter depuis Figma : Fichier \u2192 Enregistrer une copie locale (.fig)',
  'figma.selectFigFile': 'Veuillez sélectionner un fichier .fig',
  'figma.noPages': 'Aucune page trouvée dans le fichier .fig',
  'figma.parseFailed': 'Échec de l\u2019analyse du fichier .fig',
  'figma.convertFailed': 'Échec de la conversion du fichier Figma',
  'figma.parsing': 'Analyse du fichier .fig...',
  'figma.converting': 'Conversion des nœuds...',
  'figma.selectPage':
    'Ce fichier contient {{count}} pages. Sélectionnez celles à importer :',
  'figma.layers': '{{count}} calques',
  'figma.importAll': 'Importer toutes les pages',
  'figma.importComplete': 'Importation terminée !',
  'figma.moreWarnings': '...et {{count}} avertissements supplémentaires',
  'figma.tryAgain': 'Réessayer',
  'figma.layoutMode': 'Mode de mise en page :',
  'figma.preserveLayout': 'Conserver la mise en page Figma',
  'figma.autoLayout': 'Mise en page automatique OpenPencil',
  'figma.comingSoon': 'Bientôt disponible',

  // ── Landing Page ──
  'landing.title': 'Game Theory ',
  'landing.titleAccent': 'Analysis',
  'landing.tagline':
    'Manual strategic analysis for two-player games.',
  'landing.openAnalysis': 'Open Analysis',
  'landing.shortcutHint':
    'Press {{key1}} + {{key2}} to start a new analysis',

  // ── 404 ──
  'notFound.message': 'Page introuvable',

  // ── Component Browser ──
  'componentBrowser.title': 'Navigateur UIKit',
  'componentBrowser.exportKit': 'Exporter le kit',
  'componentBrowser.importKit': 'Importer un kit',
  'componentBrowser.kit': 'Kit :',
  'componentBrowser.all': 'Tous',
  'componentBrowser.imported': '(importé)',
  'componentBrowser.components': 'composants',
  'componentBrowser.searchComponents': 'Rechercher des composants...',
  'componentBrowser.deleteKit': 'Supprimer {{name}}',
  'componentBrowser.category.all': 'Tous',
  'componentBrowser.category.buttons': 'Boutons',
  'componentBrowser.category.inputs': 'Entrées',
  'componentBrowser.category.cards': 'Cartes',
  'componentBrowser.category.nav': 'Navigation',
  'componentBrowser.category.layout': 'Mise en page',
  'componentBrowser.category.feedback': 'Retour',
  'componentBrowser.category.data': 'Données',
  'componentBrowser.category.other': 'Autre',

  // ── Variable Picker ──
  'variablePicker.boundTo': 'Lié à --{{name}}',
  'variablePicker.bindToVariable': 'Lier à une variable',
  'variablePicker.unbind': 'Délier la variable',
  'variablePicker.noVariables': 'Aucune variable {{type}} définie',
} as const

export default fr
