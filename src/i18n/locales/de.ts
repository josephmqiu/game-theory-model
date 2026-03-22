import type { TranslationKeys } from "./en";

const de: TranslationKeys = {
  // ── Common ──
  "common.rename": "Umbenennen",
  "common.duplicate": "Duplizieren",
  "common.delete": "Löschen",
  "common.cancel": "Abbrechen",
  "common.save": "Speichern",
  "common.close": "Schließen",
  "common.connect": "Verbinden",
  "common.disconnect": "Trennen",
  "common.import": "Importieren",
  "common.export": "Exportieren",
  "common.name": "Name",
  "common.untitled": "Unbenannt",
  "common.best": "Beste",
  "common.selected": "{{count}} ausgewählt",

  // ── Toolbar ──
  "toolbar.select": "Auswählen",
  "toolbar.text": "Text",
  "toolbar.frame": "Rahmen",
  "toolbar.hand": "Hand",
  "toolbar.undo": "Rückgängig",
  "toolbar.redo": "Wiederherstellen",
  "toolbar.variables": "Variablen",
  "toolbar.uikitBrowser": "UIKit-Browser",

  // ── Shapes ──
  "shapes.rectangle": "Rechteck",
  "shapes.ellipse": "Ellipse",
  "shapes.polygon": "Polygon",
  "shapes.line": "Linie",
  "shapes.icon": "Symbol",
  "shapes.importImageSvg": "Bild oder SVG importieren\u2026",
  "shapes.pen": "Stift",
  "shapes.shapeTools": "Formwerkzeuge",
  "shapes.moreShapeTools": "Weitere Formwerkzeuge",

  // ── Top Bar ──
  "topbar.hideLayers": "Gliederung ausblenden",
  "topbar.showLayers": "Gliederung einblenden",
  "topbar.new": "Neu",
  "topbar.open": "Öffnen",
  "topbar.save": "Speichern",
  "topbar.importFigma": "Figma importieren",
  "topbar.codePanel": "Code",
  "topbar.fullscreen": "Vollbild",
  "topbar.exitFullscreen": "Vollbild beenden",
  "topbar.newAnalysis": "Neue Analyse",
  "topbar.unsavedFile": "Ungespeicherte .gta-Datei",
  "topbar.complete": "Vollst\u00e4ndig",
  "topbar.incomplete": "{{count}} Zellen \u00fcbrig",
  "topbar.issues": "{{count}} Problem(e)",
  "topbar.tooltipNew": "Eine neue Analyse starten",
  "topbar.tooltipOpen": "Eine gespeicherte .gta-Analyse \u00f6ffnen",
  "topbar.tooltipSave": "Die aktuelle Analyse speichern",
  "topbar.edited": "— Bearbeitet",
  "topbar.agentsAndMcp": "Agenten & MCP",
  "topbar.setupAgentsMcp": "Agenten & MCP einrichten",
  "topbar.connected": "verbunden",
  "topbar.agentStatus": "{{agents}} Agent{{agentSuffix}} · {{mcp}} MCP",

  // ── Right Panel ──
  "rightPanel.design": "Details",

  "rightPanel.code": "Code",
  "rightPanel.noSelection": "Element ausw\u00e4hlen",

  // ── Pages ──
  "pages.title": "Seiten",
  "pages.addPage": "Seite hinzufügen",
  "pages.moveUp": "Nach oben",
  "pages.moveDown": "Nach unten",

  // ── Status Bar ──
  "statusbar.zoomOut": "Herauszoomen",
  "statusbar.zoomIn": "Hineinzoomen",
  "statusbar.resetZoom": "Zoom zurücksetzen",

  // ── Updater ──
  "updater.softwareUpdate": "Software-Update",
  "updater.dismiss": "Schließen",
  "updater.current": "Aktuell",
  "updater.latest": "Neueste",
  "updater.unknown": "Unbekannt",
  "updater.checking": "Prüfe...",
  "updater.downloadProgress": "Downloadfortschritt",
  "updater.checkAgain": "Erneut prüfen",
  "updater.restartInstall": "Neustart & Installieren",
  "updater.installing": "Installiere...",
  "updater.releaseDate": "Veröffentlichungsdatum: {{date}}",
  "updater.restartHint":
    "Neustart zum Anwenden des Updates. Der Neustart dauert in der Regel 10–15 Sekunden.",
  "updater.unknownError": "Unbekannter Updater-Fehler.",
  "updater.title.checking": "Suche nach Updates",
  "updater.title.available": "Update gefunden",
  "updater.title.downloading": "Update wird heruntergeladen",
  "updater.title.downloaded": "Bereit zur Installation",
  "updater.title.error": "Update fehlgeschlagen",
  "updater.subtitle.checking": "Suche nach der neuesten Version...",
  "updater.subtitle.available": "Version {{version}} ist verfügbar.",
  "updater.subtitle.availableGeneric": "Eine neue Version ist verfügbar.",
  "updater.subtitle.downloading":
    "Version {{version}} wird im Hintergrund heruntergeladen.",
  "updater.subtitle.downloadingGeneric":
    "Update-Paket wird im Hintergrund heruntergeladen.",
  "updater.subtitle.downloaded": "Version {{version}} wurde heruntergeladen.",
  "updater.subtitle.downloadedGeneric": "Das Update wurde heruntergeladen.",
  "updater.subtitle.error":
    "Das Update konnte nicht geprüft oder heruntergeladen werden.",

  // ── Layers ──
  "layers.title": "Gliederung",
  "layers.empty":
    "Noch keine Elemente. Verwenden Sie die Werkzeugleiste, um zu beginnen.",

  // ── Layer Context Menu ──
  "layerMenu.groupSelection": "Auswahl gruppieren",
  "layerMenu.createComponent": "Komponente erstellen",
  "layerMenu.detachComponent": "Komponente lösen",
  "layerMenu.detachInstance": "Instanz lösen",
  "layerMenu.booleanUnion": "Vereinigung",
  "layerMenu.booleanSubtract": "Subtraktion",
  "layerMenu.booleanIntersect": "Schnittmenge",
  "layerMenu.toggleLock": "Sperren umschalten",
  "layerMenu.toggleVisibility": "Sichtbarkeit umschalten",

  // ── Property Panel ──
  "property.createComponent": "Komponente erstellen",
  "property.detachComponent": "Komponente lösen",
  "property.goToComponent": "Zur Komponente gehen",
  "property.detachInstance": "Instanz lösen",

  // ── Fill ──
  "fill.title": "Füllung",
  "fill.solid": "Vollton",
  "fill.linear": "Linear",
  "fill.radial": "Radial",
  "fill.image": "Bild",
  "fill.stops": "Stops",
  "fill.angle": "Winkel",

  // ── Image ──
  "image.title": "Bild",
  "image.fit": "Anpassungsmodus",
  "image.fill": "Füllen",
  "image.fitMode": "Anpassen",
  "image.crop": "Zuschneiden",
  "image.tile": "Kacheln",
  "image.clickToUpload": "Zum Hochladen klicken",
  "image.changeImage": "Bild ändern",
  "image.adjustments": "Anpassungen",
  "image.exposure": "Belichtung",
  "image.contrast": "Kontrast",
  "image.saturation": "Sättigung",
  "image.temperature": "Temperatur",
  "image.tint": "Farbton",
  "image.highlights": "Lichter",
  "image.shadows": "Schatten",
  "image.reset": "Zurücksetzen",

  // ── Stroke ──
  "stroke.title": "Kontur",

  // ── Appearance ──
  "appearance.layer": "Ebene",
  "appearance.opacity": "Deckkraft",

  // ── Layout ──
  "layout.flexLayout": "Flex-Layout",
  "layout.freedom": "Frei (kein Layout)",
  "layout.vertical": "Vertikales Layout",
  "layout.horizontal": "Horizontales Layout",
  "layout.alignment": "Ausrichtung",
  "layout.gap": "Abstand",
  "layout.spaceBetween": "Zwischenraum",
  "layout.spaceAround": "Umgebungsraum",
  "layout.dimensions": "Abmessungen",
  "layout.fillWidth": "Breite füllen",
  "layout.fillHeight": "Höhe füllen",
  "layout.hugWidth": "Breite anpassen",
  "layout.hugHeight": "Höhe anpassen",
  "layout.clipContent": "Inhalt beschneiden",

  // ── Padding ──
  "padding.title": "Innenabstand",
  "padding.paddingMode": "Innenabstandmodus",
  "padding.paddingValues": "Innenabstandwerte",
  "padding.oneValue": "Ein Wert für alle Seiten",
  "padding.horizontalVertical": "Horizontal/Vertikal",
  "padding.topRightBottomLeft": "Oben/Rechts/Unten/Links",

  // ── Typography ──
  "text.typography": "Typografie",
  "text.lineHeight": "Zeilenhöhe",
  "text.letterSpacing": "Zeichenabstand",
  "text.horizontal": "Horizontal",
  "text.vertical": "Vertikal",
  "text.alignLeft": "Linksbündig",
  "text.alignCenter": "Zentriert",
  "text.alignRight": "Rechtsbündig",
  "text.justify": "Blocksatz",
  "text.top": "Oben",
  "text.middle": "Mitte",
  "text.bottom": "Unten",
  "text.weight.thin": "Dünn",
  "text.weight.light": "Leicht",
  "text.weight.regular": "Normal",
  "text.weight.medium": "Mittel",
  "text.weight.semibold": "Halbfett",
  "text.weight.bold": "Fett",
  "text.weight.black": "Schwarz",
  "text.font.search": "Schriften suchen\u2026",
  "text.font.bundled": "Mitgeliefert",
  "text.font.system": "System",
  "text.font.loading": "Schriften werden geladen\u2026",
  "text.font.noResults": "Keine Schriften gefunden",

  // ── Text Layout ──
  "textLayout.title": "Layout",
  "textLayout.dimensions": "Abmessungen",
  "textLayout.resizing": "Größenanpassung",
  "textLayout.autoWidth": "Auto B",
  "textLayout.autoWidthDesc": "Auto Breite — Text dehnt sich horizontal aus",
  "textLayout.autoHeight": "Auto H",
  "textLayout.autoHeightDesc": "Auto Höhe — feste Breite, Höhe passt sich an",
  "textLayout.fixed": "Fest",
  "textLayout.fixedDesc": "Feste Größe — Breite und Höhe sind festgelegt",
  "textLayout.fillWidth": "Breite füllen",
  "textLayout.fillHeight": "Höhe füllen",

  // ── Effects ──
  "effects.title": "Effekte",
  "effects.dropShadow": "Schlagschatten",
  "effects.blur": "Unschärfe",
  "effects.spread": "Ausdehnung",
  "effects.color": "Farbe",

  // ── Export ──
  "export.title": "Exportieren",
  "export.format": "Format",
  "export.scale": "Skalierung",
  "export.selectedOnly": "Nur Auswahl exportieren",
  "export.exportFormat": "{{format}} exportieren",
  "export.exportLayer": "Ebene exportieren",

  // ── Polygon ──
  "polygon.sides": "Seiten",

  // ── Ellipse ──
  "ellipse.start": "Start",
  "ellipse.sweep": "Bogen",
  "ellipse.innerRadius": "Innen",

  // ── Corner Radius ──
  "cornerRadius.title": "Eckenradius",

  // ── Size / Position ──
  "size.position": "Position",

  // ── Icon ──
  "icon.title": "Symbol",
  "icon.searchIcons": "Symbole suchen...",
  "icon.noIconsFound": "Keine Symbole gefunden",
  "icon.typeToSearch": "Tippen, um Iconify-Symbole zu suchen",
  "icon.iconsCount": "{{count}} Symbole",

  // ── Variables Panel ──
  "variables.addTheme": "Theme hinzufügen",
  "variables.addVariant": "Variante hinzufügen",
  "variables.addVariable": "Variable hinzufügen",
  "variables.searchVariables": "Variablen suchen...",
  "variables.noMatch": "Keine Variablen entsprechen Ihrer Suche",
  "variables.noDefined": "Keine Variablen definiert",
  "variables.closeShortcut": "Schließen (\u2318\u21e7V)",
  "variables.presets": "Vorlagen",
  "variables.savePreset": "Aktuelles als Vorlage speichern…",
  "variables.loadPreset": "Vorlage laden",
  "variables.importPreset": "Aus Datei importieren…",
  "variables.exportPreset": "In Datei exportieren…",
  "variables.presetName": "Vorlagenname",
  "variables.noPresets": "Keine gespeicherten Vorlagen",

  // ── AI Chat ──
  "ai.newChat": "Neuer Chat",
  "ai.collapse": "Einklappen",
  "ai.tryExample": "Einen Arbeitsbereich-Befehl ausprobieren\u2026",
  "ai.tipSelectElements":
    "Tipp: W\u00e4hlen Sie Elemente im Arbeitsbereich aus, bevor Sie chatten, um Kontext zu liefern.",
  "ai.generating": "Generiere...",
  "ai.designWithAgent": "Einen Agenten zu diesem Arbeitsbereich befragen\u2026",
  "ai.attachImage": "Bild anhängen",
  "ai.stopGenerating": "Generierung stoppen",
  "ai.sendMessage": "Nachricht senden",
  "ai.loadingModels": "Modelle werden geladen...",
  "ai.noModelsConnected": "Keine Modelle verbunden",
  "ai.quickAction.loginScreen": "Diesen Arbeitsbereich zusammenfassen",
  "ai.quickAction.loginScreenPrompt":
    "Fasse den aktuellen Arbeitsbereich und die wichtigsten sichtbaren Elemente im Dokumentkontext zusammen.",
  "ai.quickAction.foodApp": "Die Auswahl beschreiben",
  "ai.quickAction.foodAppPrompt":
    "Beschreibe die aktuell ausgew\u00e4hlten Elemente und alle wichtigen Strukturen, die dir auffallen.",
  "ai.quickAction.bottomNav": "N\u00e4chste Schritte vorschlagen",
  "ai.quickAction.bottomNavPrompt":
    "Schlage basierend auf dem aktuellen Arbeitsbereich drei konkrete n\u00e4chste Schritte vor.",
  "ai.quickAction.colorPalette": "Verf\u00fcgbare Agenten erkl\u00e4ren",
  "ai.quickAction.colorPalettePrompt":
    "Erkl\u00e4re, welche verbundenen Agenten und MCP-Tools derzeit verf\u00fcgbar sind und wie sie in diesem Arbeitsbereich helfen k\u00f6nnten.",

  // ── Code Panel ──
  "code.reactTailwind": "React + Tailwind",
  "code.htmlCss": "HTML + CSS",
  "code.cssVariables": "CSS Variables",
  "code.copyClipboard": "In Zwischenablage kopieren",
  "code.copied": "Kopiert!",
  "code.download": "Code-Datei herunterladen",
  "code.closeCodePanel": "Code-Panel schließen",
  "code.genCssVars": "CSS-Variablen für das gesamte Dokument generieren",
  "code.genSelected": "Code für {{count}} ausgewählte(s) Element(e) generieren",
  "code.genDocument": "Code für das gesamte Dokument generieren",
  "code.aiEnhance": "KI-Verbesserung",
  "code.cancelEnhance": "Verbesserung abbrechen",
  "code.resetEnhance": "Zurücksetzen",
  "code.enhancing": "KI verbessert den Code...",
  "code.enhanced": "Von KI verbessert",

  // ── Save Dialog ──
  "save.saveAs": "Speichern unter",
  "save.fileName": "Dateiname",

  // ── Agent Settings ──
  "agents.title": "Agenten & MCP einrichten",
  "agents.agentsOnCanvas": "Agenten auf der Arbeitsfläche",
  "agents.mcpIntegrations": "MCP-Integrationen im Terminal",
  "agents.transport": "Transport",
  "agents.port": "Port",
  "agents.mcpRestart":
    "MCP-Integrationen werden nach einem Neustart des Terminals wirksam.",
  "agents.modelCount": "{{count}} Modell(e)",
  "agents.connectionFailed": "Verbindung fehlgeschlagen",
  "agents.serverError": "Serverfehler {{status}}",
  "agents.failedTo": "{{action}} fehlgeschlagen",
  "agents.failedToMcp": "MCP-Server {{action}} fehlgeschlagen",
  "agents.failedTransport": "Transport konnte nicht aktualisiert werden",
  "agents.failedMcpTransport": "MCP-Transport konnte nicht aktualisiert werden",
  "agents.claudeCode": "Claude Code",
  "agents.claudeModels": "Claude-Modelle",
  "agents.codexCli": "Codex CLI",
  "agents.openaiModels": "OpenAI-Modelle",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ LLM-Anbieter",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "GitHub Copilot-Modelle",
  "agents.mcpServer": "MCP-Server",
  "agents.mcpServerStart": "Starten",
  "agents.mcpServerStop": "Stoppen",
  "agents.mcpServerRunning": "Läuft",
  "agents.mcpServerStopped": "Gestoppt",
  "agents.mcpLanAccess": "LAN-Zugriff",
  "agents.mcpClientConfig": "Client-Konfiguration",
  "agents.stdio": "stdio",
  "agents.http": "http",
  "agents.stdioHttp": "stdio + http",
  "agents.autoUpdate": "Automatisch nach Updates suchen",
  "agents.notInstalled": "Nicht installiert",
  "agents.install": "Installieren",
  "agents.installing": "Installiere...",
  "agents.installFailed": "Installation fehlgeschlagen",
  "agents.viewDocs": "Doku",
  "agents.analysisRuntime": "Analyse-Laufzeit",
  "agents.analysisWebSearch": "Websuche",
  "agents.analysisWebSearchHint":
    "Live-Webrecherche w\u00e4hrend der Analyse verwenden.",
  "agents.analysisEffort": "Analyseaufwand",
  "agents.analysisEffortHint":
    "Steuert die Analysetiefe, nicht die Modellauswahl.",
  "agents.analysisEffortQuick": "Schnell",
  "agents.analysisEffortStandard": "Standard",
  "agents.analysisEffortThorough": "Gr\u00fcndlich",
  "agents.analysisPhases": "Phasenauswahl",
  "agents.analysisPhasesHint":
    "Benutzerdefinierte Ausf\u00fchrung startet nur die ausgew\u00e4hlten Phasen und kann die automatische nachgelagerte Revalidierung deaktivieren.",
  "agents.analysisPhasesAll": "Alle Phasen",
  "agents.analysisPhasesCustom": "Benutzerdefiniert",

  // ── Figma Import ──
  "figma.title": "Aus Figma importieren",
  "figma.dropFile": ".fig-Datei hier ablegen",
  "figma.orBrowse": "oder zum Durchsuchen klicken",
  "figma.exportTip":
    "Aus Figma exportieren: Datei \u2192 Lokale Kopie speichern (.fig)",
  "figma.selectFigFile": "Bitte eine .fig-Datei auswählen",
  "figma.noPages": "Keine Seiten in der .fig-Datei gefunden",
  "figma.parseFailed": ".fig-Datei konnte nicht gelesen werden",
  "figma.convertFailed": "Figma-Datei konnte nicht konvertiert werden",
  "figma.parsing": ".fig-Datei wird gelesen...",
  "figma.converting": "Knoten werden konvertiert...",
  "figma.selectPage":
    "Diese Datei hat {{count}} Seiten. Wähle, welche importiert werden sollen:",
  "figma.layers": "{{count}} Ebenen",
  "figma.importAll": "Alle Seiten importieren",
  "figma.importComplete": "Import abgeschlossen!",
  "figma.moreWarnings": "...und {{count}} weitere Warnungen",
  "figma.tryAgain": "Erneut versuchen",
  "figma.layoutMode": "Layout-Modus:",
  "figma.preserveLayout": "Figma-Layout beibehalten",
  "figma.autoLayout": "Auto-Layout",
  "figma.comingSoon": "Demnächst",

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Seite nicht gefunden",

  // ── Component Browser ──
  "componentBrowser.title": "UIKit-Browser",
  "componentBrowser.exportKit": "Kit exportieren",
  "componentBrowser.importKit": "Kit importieren",
  "componentBrowser.kit": "Kit:",
  "componentBrowser.all": "Alle",
  "componentBrowser.imported": "(importiert)",
  "componentBrowser.components": "Komponenten",
  "componentBrowser.searchComponents": "Komponenten suchen...",
  "componentBrowser.deleteKit": "{{name}} löschen",
  "componentBrowser.category.all": "Alle",
  "componentBrowser.category.buttons": "Schaltflächen",
  "componentBrowser.category.inputs": "Eingabefelder",
  "componentBrowser.category.cards": "Karten",
  "componentBrowser.category.nav": "Navigation",
  "componentBrowser.category.layout": "Layout",
  "componentBrowser.category.feedback": "Feedback",
  "componentBrowser.category.data": "Daten",
  "componentBrowser.category.other": "Sonstige",

  // ── Variable Picker ──
  "variablePicker.boundTo": "Gebunden an --{{name}}",
  "variablePicker.bindToVariable": "An Variable binden",
  "variablePicker.unbind": "Variable lösen",
  "variablePicker.noVariables": "Keine {{type}}-Variablen definiert",

  // ── Analysis ──
  "analysis.title": "Spieltheorie-Analyst",
  "analysis.emptyState":
    "Ich bin Ihr Spieltheorie-Analyst. Welches Ereignis möchten Sie analysieren?",
  "analysis.emptyHint":
    "Ich identifiziere Spieler, Strategien und Spielstruktur automatisch.",
  "analysis.inputPlaceholder": "Beschreiben Sie ein Ereignis zur Analyse...",
  "analysis.startingAnalysis":
    'Starte spieltheoretische Analyse von "{{topic}}"...',
  "analysis.cannotChangeModel":
    "Das Modell kann nicht gewechselt werden, während die Analyse läuft. Stoppen Sie zuerst die Analyse.",
  "analysis.unsavedChanges":
    "Sie haben ungespeicherte Analyseänderungen. Verwerfen und eine neue Analyse starten?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "Phasenanalyse wird vorbereitet.",
  "analysis.activity.researching": "Evidenz wird recherchiert.",
  "analysis.activity.synthesizing": "Phasenergebnis wird synthetisiert.",
  "analysis.activity.validating": "Strukturierte Ausgabe wird validiert.",
  "analysis.activity.retrying":
    "Phase wird nach Validierungs- oder Transportfehler wiederholt.",
  "analysis.activity.default": "Phasenanalyse wird fortgesetzt.",
  "analysis.activity.usingTool": "Verwende {{toolName}}",
  "analysis.activity.agentProgress": "Agentenfortschritt",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Phase {{number}} fehlgeschlagen",
  "analysis.progress.phaseLabel": "Phase {{number}}: {{name}}",
  "analysis.progress.phasesComplete":
    "{{completed}}/{{total}} Phasen abgeschlossen",
  "analysis.progress.entityCount": "{{count}} Entität",
  "analysis.progress.entityCountPlural": "{{count}} Entitäten",

  // ── Analysis Failures ──
  "analysis.failure.timeout": "Zeitüberschreitung",
  "analysis.failure.parseError": "Analysefehler",
  "analysis.failure.providerError": "Anbieterfehler",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "Situative Einordnung",
  "analysis.phases.playerIdentification": "Spieleridentifikation",
  "analysis.phases.baselineModel": "Basismodell",
  "analysis.phases.historicalGame": "Historisches Spiel",
  "analysis.phases.revalidation": "Revalidierung",
  "analysis.phases.formalModeling": "Formale Modellierung",
  "analysis.phases.assumptions": "Annahmen",
  "analysis.phases.elimination": "Elimination",
  "analysis.phases.scenarios": "Szenarien",
  "analysis.phases.metaCheck": "Meta-Prüfung",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "Phase erneut ausführen",
  "analysis.sidebar.searchEntities": "Entitäten suchen...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "Fakt",
  "analysis.entities.player": "Spieler",
  "analysis.entities.objective": "Ziel",
  "analysis.entities.game": "Spiel",
  "analysis.entities.strategy": "Strategie",
  "analysis.entities.payoff": "Auszahlung",
  "analysis.entities.rule": "Regel",
  "analysis.entities.escalation": "Eskalation",
  "analysis.entities.history": "Verlauf",
  "analysis.entities.pattern": "Muster",
  "analysis.entities.trust": "Vertrauen",
  "analysis.entities.commitment": "Verpflichtung",
  "analysis.entities.signal": "Signal",
  "analysis.entities.matrix": "Matrix",
  "analysis.entities.gameTree": "Spielbaum",
  "analysis.entities.equilibrium": "Gleichgewicht",
  "analysis.entities.constraints": "Beschränkungen",
  "analysis.entities.crossGame": "Spielübergreifend",
  "analysis.entities.signalClass": "Signalklasse",
  "analysis.entities.bargaining": "Verhandlung",
  "analysis.entities.optionValue": "Optionswert",
  "analysis.entities.behavioral": "Verhaltensbasiert",
  "analysis.entities.assumption": "Annahme",
  "analysis.entities.eliminated": "Eliminiert",
  "analysis.entities.scenario": "Szenario",
  "analysis.entities.thesis": "These",
  "analysis.entities.metaCheck": "Meta-Prüfung",
  "analysis.entities.noMatching": "Keine passenden Entitäten",
  "analysis.entities.searchHint":
    "Versuchen Sie einen anderen Suchbegriff oder entfernen Sie den Typfilter.",
  "analysis.entities.confidence.high": "Hoch",
  "analysis.entities.confidence.medium": "Mittel",
  "analysis.entities.confidence.low": "Niedrig",
  "analysis.entities.source.ai": "KI",
  "analysis.entities.source.human": "Mensch",
  "analysis.entities.source.computed": "Berechnet",
} as const;

export default de;
