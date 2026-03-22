import type { TranslationKeys } from "./en";

const fr: TranslationKeys = {
  // ── Common ──
  "common.rename": "Renommer",
  "common.duplicate": "Dupliquer",
  "common.delete": "Supprimer",
  "common.cancel": "Annuler",
  "common.save": "Enregistrer",
  "common.close": "Fermer",
  "common.connect": "Connecter",
  "common.disconnect": "Déconnecter",
  "common.import": "Importer",
  "common.export": "Exporter",
  "common.name": "Nom",
  "common.untitled": "Sans titre",
  "common.best": "Recommandé",
  "common.selected": "{{count}} sélectionné(s)",

  // ── Toolbar ──
  "toolbar.select": "Sélection",
  "toolbar.text": "Texte",
  "toolbar.frame": "Cadre",
  "toolbar.hand": "Main",
  "toolbar.undo": "Annuler",
  "toolbar.redo": "Rétablir",
  "toolbar.variables": "Variables",
  "toolbar.uikitBrowser": "Navigateur UIKit",

  // ── Shapes ──
  "shapes.rectangle": "Rectangle",
  "shapes.ellipse": "Ellipse",
  "shapes.polygon": "Polygone",
  "shapes.line": "Ligne",
  "shapes.icon": "Icône",
  "shapes.importImageSvg": "Importer une image ou un SVG\u2026",
  "shapes.pen": "Plume",
  "shapes.shapeTools": "Outils de forme",
  "shapes.moreShapeTools": "Plus d\u2019outils de forme",

  // ── Top Bar ──
  "topbar.hideLayers": "Masquer le plan",
  "topbar.showLayers": "Afficher le plan",
  "topbar.new": "Nouveau",
  "topbar.open": "Ouvrir",
  "topbar.save": "Enregistrer",
  "topbar.importFigma": "Importer Figma",
  "topbar.codePanel": "Code",
  "topbar.fullscreen": "Plein écran",
  "topbar.exitFullscreen": "Quitter le plein écran",
  "topbar.newAnalysis": "Nouvelle analyse",
  "topbar.unsavedFile": "Fichier .gta non enregistr\u00e9",
  "topbar.complete": "Termin\u00e9",
  "topbar.incomplete": "{{count}} cellules restantes",
  "topbar.issues": "{{count}} probl\u00e8me(s)",
  "topbar.tooltipNew": "D\u00e9marrer une nouvelle analyse",
  "topbar.tooltipOpen": "Ouvrir une analyse .gta enregistr\u00e9e",
  "topbar.tooltipSave": "Enregistrer l\u2019analyse en cours",
  "topbar.edited": "— Modifié",
  "topbar.agentsAndMcp": "Agents & MCP",
  "topbar.setupAgentsMcp": "Configurer Agents & MCP",
  "topbar.connected": "connecté",
  "topbar.agentStatus": "{{agents}} agent{{agentSuffix}} · {{mcp}} MCP",

  // ── Right Panel ──
  "rightPanel.design": "D\u00e9tails",
  "rightPanel.code": "Code",
  "rightPanel.noSelection": "S\u00e9lectionner un \u00e9l\u00e9ment",

  // ── Pages ──
  "pages.title": "Pages",
  "pages.addPage": "Ajouter une page",
  "pages.moveUp": "Monter",
  "pages.moveDown": "Descendre",

  // ── Status Bar ──
  "statusbar.zoomOut": "Dézoomer",
  "statusbar.zoomIn": "Zoomer",
  "statusbar.resetZoom": "Réinitialiser le zoom",

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
  "layers.title": "Plan",
  "layers.empty":
    "Aucun \u00e9l\u00e9ment pour l\u2019instant. Utilisez la barre d\u2019outils pour commencer.",

  // ── Layer Context Menu ──
  "layerMenu.groupSelection": "Grouper la sélection",
  "layerMenu.createComponent": "Créer un composant",
  "layerMenu.detachComponent": "Détacher le composant",
  "layerMenu.detachInstance": "Détacher l\u2019instance",
  "layerMenu.booleanUnion": "Union",
  "layerMenu.booleanSubtract": "Soustraire",
  "layerMenu.booleanIntersect": "Intersection",
  "layerMenu.toggleLock": "Verrouiller / Déverrouiller",
  "layerMenu.toggleVisibility": "Afficher / Masquer",

  // ── Property Panel ──
  "property.createComponent": "Créer un composant",
  "property.detachComponent": "Détacher le composant",
  "property.goToComponent": "Aller au composant",
  "property.detachInstance": "Détacher l\u2019instance",

  // ── Fill ──
  "fill.title": "Remplissage",
  "fill.solid": "Uni",
  "fill.linear": "Linéaire",
  "fill.radial": "Radial",
  "fill.image": "Image",
  "fill.stops": "Arrêts",
  "fill.angle": "Angle",

  // ── Image ──
  "image.title": "Image",
  "image.fit": "Mode d'ajustement",
  "image.fill": "Remplir",
  "image.fitMode": "Ajuster",
  "image.crop": "Recadrer",
  "image.tile": "Mosaïque",
  "image.clickToUpload": "Cliquez pour télécharger",
  "image.changeImage": "Changer l'image",
  "image.adjustments": "Réglages",
  "image.exposure": "Exposition",
  "image.contrast": "Contraste",
  "image.saturation": "Saturation",
  "image.temperature": "Température",
  "image.tint": "Teinte",
  "image.highlights": "Hautes lumières",
  "image.shadows": "Ombres",
  "image.reset": "Réinitialiser",

  // ── Stroke ──
  "stroke.title": "Contour",

  // ── Appearance ──
  "appearance.layer": "Calque",
  "appearance.opacity": "Opacité",

  // ── Layout ──
  "layout.flexLayout": "Mise en page Flex",
  "layout.freedom": "Libre (sans mise en page)",
  "layout.vertical": "Mise en page verticale",
  "layout.horizontal": "Mise en page horizontale",
  "layout.alignment": "Alignement",
  "layout.gap": "Espacement",
  "layout.spaceBetween": "Espace entre",
  "layout.spaceAround": "Espace autour",
  "layout.dimensions": "Dimensions",
  "layout.fillWidth": "Remplir la largeur",
  "layout.fillHeight": "Remplir la hauteur",
  "layout.hugWidth": "Ajuster à la largeur",
  "layout.hugHeight": "Ajuster à la hauteur",
  "layout.clipContent": "Rogner le contenu",

  // ── Padding ──
  "padding.title": "Marge intérieure",
  "padding.paddingMode": "Mode de marge intérieure",
  "padding.paddingValues": "Valeurs de marge intérieure",
  "padding.oneValue": "Une valeur pour tous les côtés",
  "padding.horizontalVertical": "Horizontal/Vertical",
  "padding.topRightBottomLeft": "Haut/Droite/Bas/Gauche",

  // ── Typography ──
  "text.typography": "Typographie",
  "text.lineHeight": "Interligne",
  "text.letterSpacing": "Espacement des lettres",
  "text.horizontal": "Horizontal",
  "text.vertical": "Vertical",
  "text.alignLeft": "Aligner à gauche",
  "text.alignCenter": "Centrer",
  "text.alignRight": "Aligner à droite",
  "text.justify": "Justifier",
  "text.top": "Haut",
  "text.middle": "Milieu",
  "text.bottom": "Bas",
  "text.weight.thin": "Thin",
  "text.weight.light": "Light",
  "text.weight.regular": "Regular",
  "text.weight.medium": "Medium",
  "text.weight.semibold": "Semibold",
  "text.weight.bold": "Bold",
  "text.weight.black": "Black",
  "text.font.search": "Rechercher des polices\u2026",
  "text.font.bundled": "Incluses",
  "text.font.system": "Système",
  "text.font.loading": "Chargement des polices\u2026",
  "text.font.noResults": "Aucune police trouvée",

  // ── Text Layout ──
  "textLayout.title": "Mise en page",
  "textLayout.dimensions": "Dimensions",
  "textLayout.resizing": "Redimensionnement",
  "textLayout.autoWidth": "Auto W",
  "textLayout.autoWidthDesc":
    "Largeur automatique — le texte s\u2019étend horizontalement",
  "textLayout.autoHeight": "Auto H",
  "textLayout.autoHeightDesc":
    "Hauteur automatique — largeur fixe, hauteur auto-ajustée",
  "textLayout.fixed": "Fixe",
  "textLayout.fixedDesc": "Taille fixe — la largeur et la hauteur sont fixes",
  "textLayout.fillWidth": "Remplir la largeur",
  "textLayout.fillHeight": "Remplir la hauteur",

  // ── Effects ──
  "effects.title": "Effets",
  "effects.dropShadow": "Ombre portée",
  "effects.blur": "Flou",
  "effects.spread": "Étendue",
  "effects.color": "Couleur",

  // ── Export ──
  "export.title": "Exporter",
  "export.format": "Format",
  "export.scale": "Échelle",
  "export.selectedOnly": "Exporter la sélection uniquement",
  "export.exportFormat": "Exporter en {{format}}",
  "export.exportLayer": "Exporter le calque",

  // ── Polygon ──
  "polygon.sides": "Côtés",

  // ── Ellipse ──
  "ellipse.start": "Début",
  "ellipse.sweep": "Balayage",
  "ellipse.innerRadius": "Intérieur",

  // ── Corner Radius ──
  "cornerRadius.title": "Rayon de coin",

  // ── Size / Position ──
  "size.position": "Position",

  // ── Icon ──
  "icon.title": "Icône",
  "icon.searchIcons": "Rechercher des icônes...",
  "icon.noIconsFound": "Aucune icône trouvée",
  "icon.typeToSearch": "Tapez pour rechercher des icônes Iconify",
  "icon.iconsCount": "{{count}} icônes",

  // ── Variables Panel ──
  "variables.addTheme": "Ajouter un thème",
  "variables.addVariant": "Ajouter une variante",
  "variables.addVariable": "Ajouter une variable",
  "variables.searchVariables": "Rechercher des variables...",
  "variables.noMatch": "Aucune variable ne correspond à votre recherche",
  "variables.noDefined": "Aucune variable définie",
  "variables.closeShortcut": "Fermer (⌘⇧V)",
  "variables.presets": "Préréglages",
  "variables.savePreset": "Enregistrer comme préréglage…",
  "variables.loadPreset": "Charger un préréglage",
  "variables.importPreset": "Importer depuis un fichier…",
  "variables.exportPreset": "Exporter vers un fichier…",
  "variables.presetName": "Nom du préréglage",
  "variables.noPresets": "Aucun préréglage enregistré",

  // ── AI Chat ──
  "ai.newChat": "Nouvelle conversation",
  "ai.collapse": "Réduire",
  "ai.tryExample": "Essayez une commande d\u2019espace de travail\u2026",
  "ai.tipSelectElements":
    "Astuce : s\u00e9lectionnez des \u00e9l\u00e9ments dans l\u2019espace de travail avant de discuter pour fournir du contexte.",
  "ai.generating": "Génération...",
  "ai.designWithAgent": "Interroger un agent sur cet espace de travail\u2026",
  "ai.attachImage": "Joindre une image",
  "ai.stopGenerating": "Arrêter la génération",
  "ai.sendMessage": "Envoyer le message",
  "ai.loadingModels": "Chargement des modèles...",
  "ai.noModelsConnected": "Aucun modèle connecté",
  "ai.quickAction.loginScreen": "R\u00e9sumer cet espace de travail",
  "ai.quickAction.loginScreenPrompt":
    "R\u00e9sume l\u2019espace de travail actuel et les principaux \u00e9l\u00e9ments visibles dans le contexte du document.",
  "ai.quickAction.foodApp": "D\u00e9crire la s\u00e9lection",
  "ai.quickAction.foodAppPrompt":
    "D\u00e9cris les \u00e9l\u00e9ments actuellement s\u00e9lectionn\u00e9s et toute structure importante que tu remarques.",
  "ai.quickAction.bottomNav": "Sugg\u00e9rer les prochaines \u00e9tapes",
  "ai.quickAction.bottomNavPrompt":
    "En fonction de l\u2019espace de travail actuel, sugg\u00e8re trois prochaines \u00e9tapes concr\u00e8tes.",
  "ai.quickAction.colorPalette": "Expliquer les agents disponibles",
  "ai.quickAction.colorPalettePrompt":
    "Explique quels agents connect\u00e9s et outils MCP sont actuellement disponibles et comment ils pourraient aider dans cet espace de travail.",

  // ── Code Panel ──
  "code.reactTailwind": "React + Tailwind",
  "code.htmlCss": "HTML + CSS",
  "code.cssVariables": "CSS Variables",
  "code.copyClipboard": "Copier dans le presse-papiers",
  "code.copied": "Copié !",
  "code.download": "Télécharger le fichier de code",
  "code.closeCodePanel": "Fermer le panneau de code",
  "code.genCssVars":
    "Génération des variables CSS pour l\u2019ensemble du document",
  "code.genSelected":
    "Génération du code pour {{count}} élément(s) sélectionné(s)",
  "code.genDocument": "Génération du code pour l\u2019ensemble du document",
  "code.aiEnhance": "Améliorer par IA",
  "code.cancelEnhance": "Annuler l\u2019amélioration",
  "code.resetEnhance": "Réinitialiser",
  "code.enhancing": "L\u2019IA améliore le code...",
  "code.enhanced": "Amélioré par IA",

  // ── Save Dialog ──
  "save.saveAs": "Enregistrer sous",
  "save.fileName": "Nom du fichier",

  // ── Agent Settings ──
  "agents.title": "Configurer Agents & MCP",
  "agents.agentsOnCanvas": "Agents sur le canevas",
  "agents.mcpIntegrations": "Intégrations MCP dans le terminal",
  "agents.transport": "Transport",
  "agents.port": "Port",
  "agents.mcpRestart":
    "Les intégrations MCP prendront effet après le redémarrage du terminal.",
  "agents.modelCount": "{{count}} modèle(s)",
  "agents.connectionFailed": "Échec de la connexion",
  "agents.serverError": "Erreur serveur {{status}}",
  "agents.failedTo": "Échec de {{action}}",
  "agents.failedToMcp": "Échec de {{action}} du serveur MCP",
  "agents.failedTransport": "Échec de la mise à jour du transport",
  "agents.failedMcpTransport": "Échec de la mise à jour du transport MCP",
  "agents.claudeCode": "Claude Code",
  "agents.claudeModels": "Modèles Claude",
  "agents.codexCli": "Codex CLI",
  "agents.openaiModels": "Modèles OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ fournisseurs LLM",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "Modèles GitHub Copilot",
  "agents.mcpServer": "Serveur MCP",
  "agents.mcpServerStart": "Démarrer",
  "agents.mcpServerStop": "Arrêter",
  "agents.mcpServerRunning": "En cours",
  "agents.mcpServerStopped": "Arrêté",
  "agents.mcpLanAccess": "Accès LAN",
  "agents.mcpClientConfig": "Config. client",
  "agents.stdio": "stdio",
  "agents.http": "http",
  "agents.stdioHttp": "stdio + http",
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
  "figma.title": "Importer depuis Figma",
  "figma.dropFile": "Déposez un fichier .fig ici",
  "figma.orBrowse": "ou cliquez pour parcourir",
  "figma.exportTip":
    "Exporter depuis Figma : Fichier \u2192 Enregistrer une copie locale (.fig)",
  "figma.selectFigFile": "Veuillez sélectionner un fichier .fig",
  "figma.noPages": "Aucune page trouvée dans le fichier .fig",
  "figma.parseFailed": "Échec de l\u2019analyse du fichier .fig",
  "figma.convertFailed": "Échec de la conversion du fichier Figma",
  "figma.parsing": "Analyse du fichier .fig...",
  "figma.converting": "Conversion des nœuds...",
  "figma.selectPage":
    "Ce fichier contient {{count}} pages. Sélectionnez celles à importer :",
  "figma.layers": "{{count}} calques",
  "figma.importAll": "Importer toutes les pages",
  "figma.importComplete": "Importation terminée !",
  "figma.moreWarnings": "...et {{count}} avertissements supplémentaires",
  "figma.tryAgain": "Réessayer",
  "figma.layoutMode": "Mode de mise en page :",
  "figma.preserveLayout": "Conserver la mise en page Figma",
  "figma.autoLayout": "Mise en page automatique OpenPencil",
  "figma.comingSoon": "Bientôt disponible",

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Page introuvable",

  // ── Component Browser ──
  "componentBrowser.title": "Navigateur UIKit",
  "componentBrowser.exportKit": "Exporter le kit",
  "componentBrowser.importKit": "Importer un kit",
  "componentBrowser.kit": "Kit :",
  "componentBrowser.all": "Tous",
  "componentBrowser.imported": "(importé)",
  "componentBrowser.components": "composants",
  "componentBrowser.searchComponents": "Rechercher des composants...",
  "componentBrowser.deleteKit": "Supprimer {{name}}",
  "componentBrowser.category.all": "Tous",
  "componentBrowser.category.buttons": "Boutons",
  "componentBrowser.category.inputs": "Entrées",
  "componentBrowser.category.cards": "Cartes",
  "componentBrowser.category.nav": "Navigation",
  "componentBrowser.category.layout": "Mise en page",
  "componentBrowser.category.feedback": "Retour",
  "componentBrowser.category.data": "Données",
  "componentBrowser.category.other": "Autre",

  // ── Variable Picker ──
  "variablePicker.boundTo": "Lié à --{{name}}",
  "variablePicker.bindToVariable": "Lier à une variable",
  "variablePicker.unbind": "Délier la variable",
  "variablePicker.noVariables": "Aucune variable {{type}} définie",

  // ── Analysis ──
  "analysis.title": "Analyste en théorie des jeux",
  "analysis.emptyState":
    "Je suis votre analyste en théorie des jeux. Quel événement souhaitez-vous analyser ?",
  "analysis.emptyHint":
    "J'identifierai automatiquement les joueurs, les stratégies et la structure du jeu.",
  "analysis.inputPlaceholder": "Décrivez un événement à analyser...",
  "analysis.startingAnalysis":
    "Lancement de l\u2019analyse en théorie des jeux de « {{topic}} »...",
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
  "analysis.activity.agentProgress": "Progression de l\u2019agent",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Phase {{number}} échouée",
  "analysis.progress.phaseLabel": "Phase {{number}} : {{name}}",
  "analysis.progress.phasesComplete":
    "{{completed}}/{{total}} phases terminées",
  "analysis.progress.entityCount": "{{count}} entité",
  "analysis.progress.entityCountPlural": "{{count}} entités",

  // ── Analysis Failures ──
  "analysis.failure.timeout": "délai dépassé",
  "analysis.failure.parseError": "erreur d\u2019analyse",
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
  "analysis.entities.noMatching": "Aucune entité correspondante",
  "analysis.entities.searchHint":
    "Essayez un autre terme de recherche ou retirez le filtre de type.",
  "analysis.entities.confidence.high": "Élevée",
  "analysis.entities.confidence.medium": "Moyenne",
  "analysis.entities.confidence.low": "Faible",
  "analysis.entities.source.ai": "IA",
  "analysis.entities.source.human": "Humain",
  "analysis.entities.source.computed": "Calculé",
} as const;

export default fr;
