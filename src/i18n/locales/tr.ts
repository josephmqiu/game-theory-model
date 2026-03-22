import type { TranslationKeys } from "./en";

const tr: TranslationKeys = {
  // ── Common ──
  "common.rename": "Yeniden Adlandır",
  "common.duplicate": "Çoğalt",
  "common.delete": "Sil",
  "common.cancel": "İptal",
  "common.save": "Kaydet",
  "common.close": "Kapat",
  "common.connect": "Bağlan",
  "common.disconnect": "Bağlantıyı Kes",
  "common.import": "İçe Aktar",
  "common.export": "Dışa Aktar",
  "common.name": "Ad",
  "common.untitled": "Adsız",
  "common.best": "En İyi",
  "common.selected": "{{count}} seçili",

  // ── Toolbar ──
  "toolbar.select": "Seç",
  "toolbar.text": "Metin",
  "toolbar.frame": "Çerçeve",
  "toolbar.hand": "El",
  "toolbar.undo": "Geri Al",
  "toolbar.redo": "Yinele",
  "toolbar.variables": "Değişkenler",
  "toolbar.uikitBrowser": "UIKit Tarayıcısı",

  // ── Shapes ──
  "shapes.rectangle": "Dikdörtgen",
  "shapes.ellipse": "Elips",
  "shapes.polygon": "Çokgen",
  "shapes.line": "Çizgi",
  "shapes.icon": "Simge",
  "shapes.importImageSvg": "Görsel veya SVG İçe Aktar\u2026",
  "shapes.pen": "Kalem",
  "shapes.shapeTools": "Şekil araçları",
  "shapes.moreShapeTools": "Diğer şekil araçları",

  // ── Top Bar ──
  "topbar.hideLayers": "Ana hatları gizle",
  "topbar.showLayers": "Ana hatları göster",
  "topbar.new": "Yeni",
  "topbar.open": "Aç",
  "topbar.save": "Kaydet",
  "topbar.importFigma": "Figma İçe Aktar",
  "topbar.codePanel": "Kod",
  "topbar.fullscreen": "Tam ekran",
  "topbar.exitFullscreen": "Tam ekrandan çık",
  "topbar.newAnalysis": "Yeni Analiz",
  "topbar.unsavedFile": "Kaydedilmemiş .gta dosyası",
  "topbar.complete": "Tamamlandı",
  "topbar.incomplete": "{{count}} hücre kaldı",
  "topbar.issues": "{{count}} sorun",
  "topbar.tooltipNew": "Yeni bir analiz başlat",
  "topbar.tooltipOpen": "Kayıtlı bir .gta analizi aç",
  "topbar.tooltipSave": "Mevcut analizi kaydet",
  "topbar.edited": "— Düzenlendi",
  "topbar.agentsAndMcp": "Ajanlar ve MCP",
  "topbar.setupAgentsMcp": "Ajanları ve MCP Kur",
  "topbar.connected": "bağlı",
  "topbar.agentStatus": "{{agents}} ajan{{agentSuffix}} · {{mcp}} MCP",

  // ── Right Panel ──
  "rightPanel.design": "Ayrıntılar",
  "rightPanel.code": "Kod",
  "rightPanel.noSelection": "Bir öge seçin",

  // ── Pages ──
  "pages.title": "Sayfalar",
  "pages.addPage": "Sayfa ekle",
  "pages.moveUp": "Yukarı Taşı",
  "pages.moveDown": "Aşağı Taşı",

  // ── Status Bar ──
  "statusbar.zoomOut": "Uzaklaştır",
  "statusbar.zoomIn": "Yakınlaştır",
  "statusbar.resetZoom": "Yakınlaştırmayı sıfırla",

  // ── Updater ──
  "updater.softwareUpdate": "Yazılım Güncellemesi",
  "updater.dismiss": "Kapat",
  "updater.current": "Mevcut",
  "updater.latest": "En Son",
  "updater.unknown": "Bilinmiyor",
  "updater.checking": "Kontrol ediliyor...",
  "updater.downloadProgress": "İndirme İlerlemesi",
  "updater.checkAgain": "Tekrar Kontrol Et",
  "updater.restartInstall": "Yeniden Başlat ve Kur",
  "updater.installing": "Kuruluyor...",
  "updater.releaseDate": "Yayın tarihi: {{date}}",
  "updater.restartHint":
    "Güncellemeyi uygulamak için yeniden başlatın. Yeniden başlatma genellikle 10-15 saniye sürer.",
  "updater.unknownError": "Bilinmeyen güncelleme hatası.",
  "updater.title.checking": "Güncellemeler kontrol ediliyor",
  "updater.title.available": "Güncelleme bulundu",
  "updater.title.downloading": "Güncelleme indiriliyor",
  "updater.title.downloaded": "Kurulmaya hazır",
  "updater.title.error": "Güncelleme başarısız",
  "updater.subtitle.checking": "En son sürüm aranıyor...",
  "updater.subtitle.available": "Sürüm {{version}} kullanılabilir.",
  "updater.subtitle.availableGeneric": "Yeni bir sürüm kullanılabilir.",
  "updater.subtitle.downloading": "Sürüm {{version}} arka planda indiriliyor.",
  "updater.subtitle.downloadingGeneric":
    "Güncelleme paketi arka planda indiriliyor.",
  "updater.subtitle.downloaded": "Sürüm {{version}} indirildi.",
  "updater.subtitle.downloadedGeneric": "Güncelleme indirildi.",
  "updater.subtitle.error": "Güncelleme kontrol edilemedi veya indirilemedi.",

  // ── Layers ──
  "layers.title": "Ana Hat",
  "layers.empty":
    "Henüz öge yok. Oluşturmaya başlamak için araç çubuğunu kullanın.",

  // ── Layer Context Menu ──
  "layerMenu.groupSelection": "Seçimi Grupla",
  "layerMenu.createComponent": "Bileşen Oluştur",
  "layerMenu.detachComponent": "Bileşeni Ayır",
  "layerMenu.detachInstance": "Örneği Ayır",
  "layerMenu.booleanUnion": "Birleştir",
  "layerMenu.booleanSubtract": "Çıkar",
  "layerMenu.booleanIntersect": "Kesiştir",
  "layerMenu.toggleLock": "Kilidi Aç/Kapat",
  "layerMenu.toggleVisibility": "Görünürlüğü Aç/Kapat",

  // ── Property Panel ──
  "property.createComponent": "Bileşen Oluştur",
  "property.detachComponent": "Bileşeni Ayır",
  "property.goToComponent": "Bileşene git",
  "property.detachInstance": "Örneği ayır",

  // ── Fill ──
  "fill.title": "Dolgu",
  "fill.solid": "Düz",
  "fill.linear": "Doğrusal",
  "fill.radial": "Dairesel",
  "fill.image": "Görüntü",
  "fill.stops": "Duraklar",
  "fill.angle": "Açı",

  // ── Image ──
  "image.title": "Görüntü",
  "image.fit": "Sığdırma Modu",
  "image.fill": "Doldur",
  "image.fitMode": "Sığdır",
  "image.crop": "Kırp",
  "image.tile": "Döşe",
  "image.clickToUpload": "Yüklemek için tıklayın",
  "image.changeImage": "Görüntüyü değiştir",
  "image.adjustments": "Ayarlamalar",
  "image.exposure": "Pozlama",
  "image.contrast": "Kontrast",
  "image.saturation": "Doygunluk",
  "image.temperature": "Sıcaklık",
  "image.tint": "Renk Tonu",
  "image.highlights": "Parlak Tonlar",
  "image.shadows": "Gölgeler",
  "image.reset": "Sıfırla",

  // ── Stroke ──
  "stroke.title": "Kenarlık",

  // ── Appearance ──
  "appearance.layer": "Katman",
  "appearance.opacity": "Opaklık",

  // ── Layout ──
  "layout.flexLayout": "Esnek Düzen",
  "layout.freedom": "Serbest (düzen yok)",
  "layout.vertical": "Dikey düzen",
  "layout.horizontal": "Yatay düzen",
  "layout.alignment": "Hizalama",
  "layout.gap": "Boşluk",
  "layout.spaceBetween": "Araya Boşluk",
  "layout.spaceAround": "Çevreye Boşluk",
  "layout.dimensions": "Boyutlar",
  "layout.fillWidth": "Genişliği Doldur",
  "layout.fillHeight": "Yüksekliği Doldur",
  "layout.hugWidth": "Genişliğe Sığ",
  "layout.hugHeight": "Yüksekliğe Sığ",
  "layout.clipContent": "İçeriği Kırp",

  // ── Padding ──
  "padding.title": "İç Boşluk",
  "padding.paddingMode": "İç boşluk modu",
  "padding.paddingValues": "İç Boşluk Değerleri",
  "padding.oneValue": "Tüm kenarlar için tek değer",
  "padding.horizontalVertical": "Yatay/Dikey",
  "padding.topRightBottomLeft": "Üst/Sağ/Alt/Sol",

  // ── Typography ──
  "text.typography": "Tipografi",
  "text.lineHeight": "Satır yüksekliği",
  "text.letterSpacing": "Harf aralığı",
  "text.horizontal": "Yatay",
  "text.vertical": "Dikey",
  "text.alignLeft": "Sola hizala",
  "text.alignCenter": "Ortala",
  "text.alignRight": "Sağa hizala",
  "text.justify": "İki yana yasla",
  "text.top": "Üst",
  "text.middle": "Orta",
  "text.bottom": "Alt",
  "text.weight.thin": "İnce",
  "text.weight.light": "Hafif",
  "text.weight.regular": "Normal",
  "text.weight.medium": "Orta",
  "text.weight.semibold": "Yarı Kalın",
  "text.weight.bold": "Kalın",
  "text.weight.black": "Siyah",
  "text.font.search": "Yazı tipi ara\u2026",
  "text.font.bundled": "Dahili",
  "text.font.system": "Sistem",
  "text.font.loading": "Yazı tipleri yükleniyor\u2026",
  "text.font.noResults": "Yazı tipi bulunamadı",

  // ── Text Layout ──
  "textLayout.title": "Düzen",
  "textLayout.dimensions": "Boyutlar",
  "textLayout.resizing": "Boyutlandırma",
  "textLayout.autoWidth": "Oto G",
  "textLayout.autoWidthDesc":
    "Otomatik Genişlik \u2014 metin yatay olarak genişler",
  "textLayout.autoHeight": "Oto Y",
  "textLayout.autoHeightDesc":
    "Otomatik Yükseklik \u2014 sabit genişlik, yükseklik otomatik ayarlanır",
  "textLayout.fixed": "Sabit",
  "textLayout.fixedDesc": "Sabit Boyut \u2014 hem genişlik hem yükseklik sabit",
  "textLayout.fillWidth": "Genişliği Doldur",
  "textLayout.fillHeight": "Yüksekliği Doldur",

  // ── Effects ──
  "effects.title": "Efektler",
  "effects.dropShadow": "Gölge",
  "effects.blur": "Bulanıklık",
  "effects.spread": "Yayılma",
  "effects.color": "Renk",

  // ── Export ──
  "export.title": "Dışa Aktar",
  "export.format": "Biçim",
  "export.scale": "Ölçek",
  "export.selectedOnly": "Yalnızca seçilenleri dışa aktar",
  "export.exportFormat": "{{format}} Dışa Aktar",
  "export.exportLayer": "Katmanı dışa aktar",

  // ── Polygon ──
  "polygon.sides": "Kenar",

  // ── Ellipse ──
  "ellipse.start": "Başlangıç",
  "ellipse.sweep": "Süpürme",
  "ellipse.innerRadius": "İç",

  // ── Corner Radius ──
  "cornerRadius.title": "Köşe Yarıçapı",

  // ── Size / Position ──
  "size.position": "Konum",

  // ── Icon ──
  "icon.title": "Simge",
  "icon.searchIcons": "Simge ara...",
  "icon.noIconsFound": "Simge bulunamadı",
  "icon.typeToSearch": "Iconify simgelerini aramak için yazın",
  "icon.iconsCount": "{{count}} simge",

  // ── Variables Panel ──
  "variables.addTheme": "Tema ekle",
  "variables.addVariant": "Varyant ekle",
  "variables.addVariable": "Değişken ekle",
  "variables.searchVariables": "Değişken ara...",
  "variables.noMatch": "Aramanızla eşleşen değişken yok",
  "variables.noDefined": "Tanımlanmış değişken yok",
  "variables.closeShortcut": "Kapat (\u2318\u21e7V)",
  "variables.presets": "Ön Ayarlar",
  "variables.savePreset": "Mevcut ayarları ön ayar olarak kaydet…",
  "variables.loadPreset": "Ön ayar yükle",
  "variables.importPreset": "Dosyadan içe aktar…",
  "variables.exportPreset": "Dosyaya dışa aktar…",
  "variables.presetName": "Ön ayar adı",
  "variables.noPresets": "Kayıtlı ön ayar yok",

  // ── AI Chat ──
  "ai.newChat": "Yeni sohbet",
  "ai.collapse": "Daralt",
  "ai.tryExample": "Bir çalışma alanı istemi deneyin...",
  "ai.tipSelectElements":
    "İpucu: Bağlam için sohbet etmeden önce çalışma alanında ögeleri seçin.",
  "ai.generating": "Oluşturuluyor...",
  "ai.designWithAgent": "Bu çalışma alanı hakkında bir ajana sorun...",
  "ai.attachImage": "Görsel ekle",
  "ai.stopGenerating": "Oluşturmayı durdur",
  "ai.sendMessage": "Mesaj gönder",
  "ai.loadingModels": "Modeller yükleniyor...",
  "ai.noModelsConnected": "Bağlı model yok",
  "ai.quickAction.loginScreen": "Bu çalışma alanını özetle",
  "ai.quickAction.loginScreenPrompt":
    "Mevcut çalışma alanını ve belge bağlamında görünen ana ögeleri özetle.",
  "ai.quickAction.foodApp": "Seçimi tanımla",
  "ai.quickAction.foodAppPrompt":
    "Şu anda seçili ögeleri ve fark ettiğiniz önemli yapıları tanımlayın.",
  "ai.quickAction.bottomNav": "Sonraki adımları öner",
  "ai.quickAction.bottomNavPrompt":
    "Mevcut çalışma alanına dayanarak üç somut sonraki adım önerin.",
  "ai.quickAction.colorPalette": "Mevcut ajanları açıkla",
  "ai.quickAction.colorPalettePrompt":
    "Şu anda hangi bağlı ajanların ve MCP araçlarının mevcut olduğunu ve bu çalışma alanında nasıl yardımcı olabileceklerini açıklayın.",

  // ── Code Panel ──
  "code.reactTailwind": "React + Tailwind",
  "code.htmlCss": "HTML + CSS",
  "code.cssVariables": "CSS Variables",
  "code.copyClipboard": "Panoya kopyala",
  "code.copied": "Kopyalandı!",
  "code.download": "Kod dosyasını indir",
  "code.closeCodePanel": "Kod panelini kapat",
  "code.genCssVars": "Tüm belge için CSS değişkenleri oluşturuluyor",
  "code.genSelected": "{{count}} seçili öge için kod oluşturuluyor",
  "code.genDocument": "Tüm belge için kod oluşturuluyor",
  "code.aiEnhance": "AI ile geliştir",
  "code.cancelEnhance": "Geliştirmeyi iptal et",
  "code.resetEnhance": "Orijinale sıfırla",
  "code.enhancing": "AI kodu geliştiriyor...",
  "code.enhanced": "AI tarafından geliştirildi",

  // ── Save Dialog ──
  "save.saveAs": "Farklı Kaydet",
  "save.fileName": "Dosya adı",

  // ── Agent Settings ──
  "agents.title": "Ajanları ve MCP Kur",
  "agents.agentsOnCanvas": "Tuvaldeki Ajanlar",
  "agents.mcpIntegrations": "Terminalde MCP Entegrasyonları",
  "agents.transport": "Aktarım",
  "agents.port": "Port",
  "agents.mcpRestart":
    "MCP entegrasyonları terminal yeniden başlatıldıktan sonra etkin olacaktır.",
  "agents.modelCount": "{{count}} model",
  "agents.connectionFailed": "Bağlantı başarısız",
  "agents.serverError": "Sunucu hatası {{status}}",
  "agents.failedTo": "{{action}} başarısız",
  "agents.failedToMcp": "MCP sunucusu {{action}} başarısız",
  "agents.failedTransport": "Aktarım güncellenemedi",
  "agents.failedMcpTransport": "MCP aktarımı güncellenemedi",
  "agents.claudeCode": "Claude Code",
  "agents.claudeModels": "Claude modelleri",
  "agents.codexCli": "Codex CLI",
  "agents.openaiModels": "OpenAI modelleri",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ LLM sağlayıcı",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "GitHub Copilot modelleri",
  "agents.mcpServer": "MCP Sunucu",
  "agents.mcpServerStart": "Başlat",
  "agents.mcpServerStop": "Durdur",
  "agents.mcpServerRunning": "Çalışıyor",
  "agents.mcpServerStopped": "Durduruldu",
  "agents.mcpLanAccess": "LAN Erişimi",
  "agents.mcpClientConfig": "İstemci yapılandırması",
  "agents.stdio": "stdio",
  "agents.http": "http",
  "agents.stdioHttp": "stdio + http",
  "agents.autoUpdate": "Otomatik güncelleme kontrolü",
  "agents.notInstalled": "Yüklü değil",
  "agents.install": "Yükle",
  "agents.installing": "Yükleniyor...",
  "agents.installFailed": "Yükleme başarısız",
  "agents.viewDocs": "Belgeler",
  "agents.analysisRuntime": "Analiz Çalışma Zamanı",
  "agents.analysisWebSearch": "Web araması",
  "agents.analysisWebSearchHint":
    "Analiz çalıştırmalarında canlı web araştırması kullan.",
  "agents.analysisEffort": "Analiz derinliği",
  "agents.analysisEffortHint":
    "Analiz çalıştırmaları için derinlik rehberliğini kontrol eder, model seçimini değil.",
  "agents.analysisEffortQuick": "Hızlı",
  "agents.analysisEffortStandard": "Standart",
  "agents.analysisEffortThorough": "Kapsamlı",
  "agents.analysisPhases": "Faz seçimi",
  "agents.analysisPhasesHint":
    "Özel faz çalıştırması yalnızca seçili fazları çalıştırır ve otomatik alt akış yeniden doğrulamasını devre dışı bırakabilir.",
  "agents.analysisPhasesAll": "Tüm fazlar",
  "agents.analysisPhasesCustom": "Özel",

  // ── Figma Import ──
  "figma.title": "Figma'dan İçe Aktar",
  "figma.dropFile": "Bir .fig dosyasını buraya bırakın",
  "figma.orBrowse": "veya göz atmak için tıklayın",
  "figma.exportTip": "Figma'dan dışa aktar: File \u2192 Save local copy (.fig)",
  "figma.selectFigFile": "Lütfen bir .fig dosyası seçin",
  "figma.noPages": ".fig dosyasında sayfa bulunamadı",
  "figma.parseFailed": ".fig dosyası ayrıştırılamadı",
  "figma.convertFailed": "Figma dosyası dönüştürülemedi",
  "figma.parsing": ".fig dosyası ayrıştırılıyor...",
  "figma.converting": "Düğümler dönüştürülüyor...",
  "figma.selectPage":
    "Bu dosyada {{count}} sayfa var. İçe aktarılacakları seçin:",
  "figma.layers": "{{count}} katman",
  "figma.importAll": "Tüm Sayfaları İçe Aktar",
  "figma.importComplete": "İçe aktarma tamamlandı!",
  "figma.moreWarnings": "...ve {{count}} uyarı daha",
  "figma.tryAgain": "Tekrar Dene",
  "figma.layoutMode": "Düzen modu:",
  "figma.preserveLayout": "Figma düzenini koru",
  "figma.autoLayout": "otomatik düzen",
  "figma.comingSoon": "Yakında",

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Sayfa bulunamadı",

  // ── Component Browser ──
  "componentBrowser.title": "UIKit Tarayıcısı",
  "componentBrowser.exportKit": "Kiti dışa aktar",
  "componentBrowser.importKit": "Kiti içe aktar",
  "componentBrowser.kit": "Kit:",
  "componentBrowser.all": "Tümü",
  "componentBrowser.imported": "(içe aktarılan)",
  "componentBrowser.components": "bileşen",
  "componentBrowser.searchComponents": "Bileşen ara...",
  "componentBrowser.deleteKit": "{{name}} sil",
  "componentBrowser.category.all": "Tümü",
  "componentBrowser.category.buttons": "Butonlar",
  "componentBrowser.category.inputs": "Girişler",
  "componentBrowser.category.cards": "Kartlar",
  "componentBrowser.category.nav": "Gezinme",
  "componentBrowser.category.layout": "Düzen",
  "componentBrowser.category.feedback": "Geri Bildirim",
  "componentBrowser.category.data": "Veri",
  "componentBrowser.category.other": "Diğer",

  // ── Variable Picker ──
  "variablePicker.boundTo": "--{{name}} ile bağlı",
  "variablePicker.bindToVariable": "Değişkene bağla",
  "variablePicker.unbind": "Değişken bağını kaldır",
  "variablePicker.noVariables": "Tanımlanmış {{type}} değişkeni yok",

  // ── Analysis ──
  "analysis.title": "Oyun Teorisi Analisti",
  "analysis.emptyState":
    "Oyun teorisi analistinizim. Hangi olayı analiz etmek istiyorsunuz?",
  "analysis.emptyHint":
    "Oyuncuları, stratejileri ve oyun yapısını otomatik olarak belirleyeceğim.",
  "analysis.inputPlaceholder": "Analiz edilecek bir olay tanımlayın...",
  "analysis.startingAnalysis":
    '"{{topic}}" için oyun-teorik analiz başlatılıyor...',
  "analysis.cannotChangeModel":
    "Analiz çalışırken model değiştirilemez. Önce analizi durdurun.",
  "analysis.unsavedChanges":
    "Kaydedilmemiş analiz değişiklikleriniz var. Bunları silip yeni bir analiz başlatmak istiyor musunuz?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "Faz analizi hazırlanıyor.",
  "analysis.activity.researching": "Kanıtlar araştırılıyor.",
  "analysis.activity.synthesizing": "Faz çıktısı sentezleniyor.",
  "analysis.activity.validating": "Yapılandırılmış çıktı doğrulanıyor.",
  "analysis.activity.retrying":
    "Doğrulama veya aktarım sorununun ardından faz yeniden deneniyor.",
  "analysis.activity.default": "Faz analizi devam ediyor.",
  "analysis.activity.usingTool": "{{toolName}} kullanılıyor",
  "analysis.activity.agentProgress": "Ajan ilerlemesi",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Faz {{number}} başarısız oldu",
  "analysis.progress.phaseLabel": "Faz {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} faz tamamlandı",
  "analysis.progress.entityCount": "{{count}} varlık",
  "analysis.progress.entityCountPlural": "{{count}} varlık",

  // ── Analysis Failures ──
  "analysis.failure.timeout": "zaman aşımı",
  "analysis.failure.parseError": "ayrıştırma hatası",
  "analysis.failure.providerError": "sağlayıcı hatası",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "Durumsal Temellendirme",
  "analysis.phases.playerIdentification": "Oyuncu Belirleme",
  "analysis.phases.baselineModel": "Temel Model",
  "analysis.phases.historicalGame": "Tarihsel Oyun",
  "analysis.phases.revalidation": "Yeniden Doğrulama",
  "analysis.phases.formalModeling": "Formel Modelleme",
  "analysis.phases.assumptions": "Varsayımlar",
  "analysis.phases.elimination": "Eleme",
  "analysis.phases.scenarios": "Senaryolar",
  "analysis.phases.metaCheck": "Meta Kontrol",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "Fazı yeniden çalıştır",
  "analysis.sidebar.searchEntities": "Varlıkları ara...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "Olgu",
  "analysis.entities.player": "Oyuncu",
  "analysis.entities.objective": "Amaç",
  "analysis.entities.game": "Oyun",
  "analysis.entities.strategy": "Strateji",
  "analysis.entities.payoff": "Getiri",
  "analysis.entities.rule": "Kural",
  "analysis.entities.escalation": "Tırmanma",
  "analysis.entities.history": "Tarihçe",
  "analysis.entities.pattern": "Örüntü",
  "analysis.entities.trust": "Güven",
  "analysis.entities.commitment": "Taahhüt",
  "analysis.entities.signal": "Sinyal",
  "analysis.entities.matrix": "Matris",
  "analysis.entities.gameTree": "Oyun Ağacı",
  "analysis.entities.equilibrium": "Denge",
  "analysis.entities.constraints": "Kısıtlar",
  "analysis.entities.crossGame": "Çapraz Oyun",
  "analysis.entities.signalClass": "Sinyal Sınıfı",
  "analysis.entities.bargaining": "Pazarlık",
  "analysis.entities.optionValue": "Opsiyon Değeri",
  "analysis.entities.behavioral": "Davranışsal",
  "analysis.entities.assumption": "Varsayım",
  "analysis.entities.eliminated": "Elenmiş",
  "analysis.entities.scenario": "Senaryo",
  "analysis.entities.thesis": "Tez",
  "analysis.entities.metaCheck": "Meta Kontrol",
  "analysis.entities.noMatching": "Eşleşen varlık yok",
  "analysis.entities.searchHint":
    "Farklı bir arama terimi deneyin veya tür filtresini kaldırın.",
  "analysis.entities.confidence.high": "Yüksek",
  "analysis.entities.confidence.medium": "Orta",
  "analysis.entities.confidence.low": "Düşük",
  "analysis.entities.source.ai": "Yapay Zeka",
  "analysis.entities.source.human": "İnsan",
  "analysis.entities.source.computed": "Hesaplanmış",
} as const;

export default tr;
