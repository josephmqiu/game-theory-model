import type { TranslationKeys } from './en'

const tr: TranslationKeys = {
  // ── Common ──
  'common.rename': 'Yeniden Adlandır',
  'common.duplicate': 'Çoğalt',
  'common.delete': 'Sil',
  'common.cancel': 'İptal',
  'common.save': 'Kaydet',
  'common.close': 'Kapat',
  'common.connect': 'Bağlan',
  'common.disconnect': 'Bağlantıyı Kes',
  'common.import': 'İçe Aktar',
  'common.export': 'Dışa Aktar',
  'common.name': 'Ad',
  'common.untitled': 'Adsız',
  'common.best': 'En İyi',
  'common.selected': '{{count}} seçili',

  // ── Toolbar ──
  'toolbar.select': 'Seç',
  'toolbar.text': 'Metin',
  'toolbar.frame': 'Çerçeve',
  'toolbar.hand': 'El',
  'toolbar.undo': 'Geri Al',
  'toolbar.redo': 'Yinele',
  'toolbar.variables': 'Değişkenler',
  'toolbar.uikitBrowser': 'UIKit Tarayıcısı',

  // ── Shapes ──
  'shapes.rectangle': 'Dikdörtgen',
  'shapes.ellipse': 'Elips',
  'shapes.polygon': 'Çokgen',
  'shapes.line': 'Çizgi',
  'shapes.icon': 'Simge',
  'shapes.importImageSvg': 'Görsel veya SVG İçe Aktar\u2026',
  'shapes.pen': 'Kalem',
  'shapes.shapeTools': 'Şekil araçları',
  'shapes.moreShapeTools': 'Diğer şekil araçları',

  // ── Top Bar ──
  'topbar.hideLayers': 'Hide outline',
  'topbar.showLayers': 'Show outline',
  'topbar.new': 'Yeni',
  'topbar.open': 'Aç',
  'topbar.save': 'Kaydet',
  'topbar.importFigma': 'Figma İçe Aktar',
  'topbar.codePanel': 'Kod',
  'topbar.lightMode': 'Açık mod',
  'topbar.darkMode': 'Koyu mod',
  'topbar.fullscreen': 'Tam ekran',
  'topbar.exitFullscreen': 'Tam ekrandan çık',
  'topbar.newAnalysis': 'New Analysis',
  'topbar.unsavedFile': 'Unsaved .gta file',
  'topbar.complete': 'Complete',
  'topbar.incomplete': '{{count}} incomplete',
  'topbar.issues': '{{count}} issue(s)',
  'topbar.tooltipNew': 'Start a fresh analysis',
  'topbar.tooltipOpen': 'Open a saved .gta analysis',
  'topbar.tooltipSave': 'Save the current analysis',
  'topbar.edited': '— Düzenlendi',
  'topbar.agentsAndMcp': 'Ajanlar ve MCP',
  'topbar.setupAgentsMcp': 'Ajanları ve MCP Kur',
  'topbar.connected': 'bağlı',
  'topbar.agentStatus': '{{agents}} ajan{{agentSuffix}} · {{mcp}} MCP',

  // ── Right Panel ──
  'rightPanel.design': 'Details',
  'rightPanel.code': 'Kod',
  'rightPanel.noSelection': 'Select an item',

  // ── Pages ──
  'pages.title': 'Sayfalar',
  'pages.addPage': 'Sayfa ekle',
  'pages.moveUp': 'Yukarı Taşı',
  'pages.moveDown': 'Aşağı Taşı',

  // ── Status Bar ──
  'statusbar.zoomOut': 'Uzaklaştır',
  'statusbar.zoomIn': 'Yakınlaştır',
  'statusbar.resetZoom': 'Yakınlaştırmayı sıfırla',

  // ── Updater ──
  'updater.softwareUpdate': 'Yazılım Güncellemesi',
  'updater.dismiss': 'Kapat',
  'updater.current': 'Mevcut',
  'updater.latest': 'En Son',
  'updater.unknown': 'Bilinmiyor',
  'updater.checking': 'Kontrol ediliyor...',
  'updater.downloadProgress': 'İndirme İlerlemesi',
  'updater.checkAgain': 'Tekrar Kontrol Et',
  'updater.restartInstall': 'Yeniden Başlat ve Kur',
  'updater.installing': 'Kuruluyor...',
  'updater.releaseDate': 'Yayın tarihi: {{date}}',
  'updater.restartHint':
    'Güncellemeyi uygulamak için yeniden başlatın. Yeniden başlatma genellikle 10-15 saniye sürer.',
  'updater.unknownError': 'Bilinmeyen güncelleme hatası.',
  'updater.title.checking': 'Güncellemeler kontrol ediliyor',
  'updater.title.available': 'Güncelleme bulundu',
  'updater.title.downloading': 'Güncelleme indiriliyor',
  'updater.title.downloaded': 'Kurulmaya hazır',
  'updater.title.error': 'Güncelleme başarısız',
  'updater.subtitle.checking': 'En son sürüm aranıyor...',
  'updater.subtitle.available': 'Sürüm {{version}} kullanılabilir.',
  'updater.subtitle.availableGeneric': 'Yeni bir sürüm kullanılabilir.',
  'updater.subtitle.downloading':
    'Sürüm {{version}} arka planda indiriliyor.',
  'updater.subtitle.downloadingGeneric':
    'Güncelleme paketi arka planda indiriliyor.',
  'updater.subtitle.downloaded': 'Sürüm {{version}} indirildi.',
  'updater.subtitle.downloadedGeneric': 'Güncelleme indirildi.',
  'updater.subtitle.error': 'Güncelleme kontrol edilemedi veya indirilemedi.',

  // ── Layers ──
  'layers.title': 'Outline',
  'layers.empty': 'No items yet. Use the toolbar to start building.',

  // ── Layer Context Menu ──
  'layerMenu.groupSelection': 'Seçimi Grupla',
  'layerMenu.createComponent': 'Bileşen Oluştur',
  'layerMenu.detachComponent': 'Bileşeni Ayır',
  'layerMenu.detachInstance': 'Örneği Ayır',
  'layerMenu.booleanUnion': 'Birleştir',
  'layerMenu.booleanSubtract': 'Çıkar',
  'layerMenu.booleanIntersect': 'Kesiştir',
  'layerMenu.toggleLock': 'Kilidi Aç/Kapat',
  'layerMenu.toggleVisibility': 'Görünürlüğü Aç/Kapat',

  // ── Property Panel ──
  'property.createComponent': 'Bileşen Oluştur',
  'property.detachComponent': 'Bileşeni Ayır',
  'property.goToComponent': 'Bileşene git',
  'property.detachInstance': 'Örneği ayır',

  // ── Fill ──
  'fill.title': 'Dolgu',
  'fill.solid': 'Düz',
  'fill.linear': 'Doğrusal',
  'fill.radial': 'Dairesel',
  'fill.image': 'Görüntü',
  'fill.stops': 'Duraklar',
  'fill.angle': 'Açı',

  // ── Image ──
  'image.title': 'Görüntü',
  'image.fit': 'Sığdırma Modu',
  'image.fill': 'Doldur',
  'image.fitMode': 'Sığdır',
  'image.crop': 'Kırp',
  'image.tile': 'Döşe',
  'image.clickToUpload': 'Yüklemek için tıklayın',
  'image.changeImage': 'Görüntüyü değiştir',
  'image.adjustments': 'Ayarlamalar',
  'image.exposure': 'Pozlama',
  'image.contrast': 'Kontrast',
  'image.saturation': 'Doygunluk',
  'image.temperature': 'Sıcaklık',
  'image.tint': 'Renk Tonu',
  'image.highlights': 'Parlak Tonlar',
  'image.shadows': 'Gölgeler',
  'image.reset': 'Sıfırla',

  // ── Stroke ──
  'stroke.title': 'Kenarlık',

  // ── Appearance ──
  'appearance.layer': 'Katman',
  'appearance.opacity': 'Opaklık',

  // ── Layout ──
  'layout.flexLayout': 'Esnek Düzen',
  'layout.freedom': 'Serbest (düzen yok)',
  'layout.vertical': 'Dikey düzen',
  'layout.horizontal': 'Yatay düzen',
  'layout.alignment': 'Hizalama',
  'layout.gap': 'Boşluk',
  'layout.spaceBetween': 'Araya Boşluk',
  'layout.spaceAround': 'Çevreye Boşluk',
  'layout.dimensions': 'Boyutlar',
  'layout.fillWidth': 'Genişliği Doldur',
  'layout.fillHeight': 'Yüksekliği Doldur',
  'layout.hugWidth': 'Genişliğe Sığ',
  'layout.hugHeight': 'Yüksekliğe Sığ',
  'layout.clipContent': 'İçeriği Kırp',

  // ── Padding ──
  'padding.title': 'İç Boşluk',
  'padding.paddingMode': 'İç boşluk modu',
  'padding.paddingValues': 'İç Boşluk Değerleri',
  'padding.oneValue': 'Tüm kenarlar için tek değer',
  'padding.horizontalVertical': 'Yatay/Dikey',
  'padding.topRightBottomLeft': 'Üst/Sağ/Alt/Sol',

  // ── Typography ──
  'text.typography': 'Tipografi',
  'text.lineHeight': 'Satır yüksekliği',
  'text.letterSpacing': 'Harf aralığı',
  'text.horizontal': 'Yatay',
  'text.vertical': 'Dikey',
  'text.alignLeft': 'Sola hizala',
  'text.alignCenter': 'Ortala',
  'text.alignRight': 'Sağa hizala',
  'text.justify': 'İki yana yasla',
  'text.top': 'Üst',
  'text.middle': 'Orta',
  'text.bottom': 'Alt',
  'text.weight.thin': 'İnce',
  'text.weight.light': 'Hafif',
  'text.weight.regular': 'Normal',
  'text.weight.medium': 'Orta',
  'text.weight.semibold': 'Yarı Kalın',
  'text.weight.bold': 'Kalın',
  'text.weight.black': 'Siyah',
  'text.font.search': 'Yazı tipi ara\u2026',
  'text.font.bundled': 'Dahili',
  'text.font.system': 'Sistem',
  'text.font.loading': 'Yazı tipleri yükleniyor\u2026',
  'text.font.noResults': 'Yazı tipi bulunamadı',

  // ── Text Layout ──
  'textLayout.title': 'Düzen',
  'textLayout.dimensions': 'Boyutlar',
  'textLayout.resizing': 'Boyutlandırma',
  'textLayout.autoWidth': 'Oto G',
  'textLayout.autoWidthDesc': 'Otomatik Genişlik \u2014 metin yatay olarak genişler',
  'textLayout.autoHeight': 'Oto Y',
  'textLayout.autoHeightDesc':
    'Otomatik Yükseklik \u2014 sabit genişlik, yükseklik otomatik ayarlanır',
  'textLayout.fixed': 'Sabit',
  'textLayout.fixedDesc':
    'Sabit Boyut \u2014 hem genişlik hem yükseklik sabit',
  'textLayout.fillWidth': 'Genişliği Doldur',
  'textLayout.fillHeight': 'Yüksekliği Doldur',

  // ── Effects ──
  'effects.title': 'Efektler',
  'effects.dropShadow': 'Gölge',
  'effects.blur': 'Bulanıklık',
  'effects.spread': 'Yayılma',
  'effects.color': 'Renk',

  // ── Export ──
  'export.title': 'Dışa Aktar',
  'export.format': 'Biçim',
  'export.scale': 'Ölçek',
  'export.selectedOnly': 'Yalnızca seçilenleri dışa aktar',
  'export.exportFormat': '{{format}} Dışa Aktar',
  'export.exportLayer': 'Katmanı dışa aktar',

  // ── Polygon ──
  'polygon.sides': 'Kenar',

  // ── Ellipse ──
  'ellipse.start': 'Başlangıç',
  'ellipse.sweep': 'Süpürme',
  'ellipse.innerRadius': 'İç',

  // ── Corner Radius ──
  'cornerRadius.title': 'Köşe Yarıçapı',

  // ── Size / Position ──
  'size.position': 'Konum',

  // ── Icon ──
  'icon.title': 'Simge',
  'icon.searchIcons': 'Simge ara...',
  'icon.noIconsFound': 'Simge bulunamadı',
  'icon.typeToSearch': 'Iconify simgelerini aramak için yazın',
  'icon.iconsCount': '{{count}} simge',

  // ── Variables Panel ──
  'variables.addTheme': 'Tema ekle',
  'variables.addVariant': 'Varyant ekle',
  'variables.addVariable': 'Değişken ekle',
  'variables.searchVariables': 'Değişken ara...',
  'variables.noMatch': 'Aramanızla eşleşen değişken yok',
  'variables.noDefined': 'Tanımlanmış değişken yok',
  'variables.closeShortcut': 'Kapat (\u2318\u21e7V)',
  'variables.presets': 'Ön Ayarlar',
  'variables.savePreset': 'Mevcut ayarları ön ayar olarak kaydet…',
  'variables.loadPreset': 'Ön ayar yükle',
  'variables.importPreset': 'Dosyadan içe aktar…',
  'variables.exportPreset': 'Dosyaya dışa aktar…',
  'variables.presetName': 'Ön ayar adı',
  'variables.noPresets': 'Kayıtlı ön ayar yok',

  // ── AI Chat ──
  'ai.newChat': 'Yeni sohbet',
  'ai.collapse': 'Daralt',
  'ai.tryExample': 'Try a workspace prompt...',
  'ai.tipSelectElements':
    'Tip: Select items in the workspace before chatting for context.',
  'ai.generating': 'Oluşturuluyor...',
  'ai.designWithAgent': 'Ask an agent about this workspace...',
  'ai.attachImage': 'Görsel ekle',
  'ai.stopGenerating': 'Oluşturmayı durdur',
  'ai.sendMessage': 'Mesaj gönder',
  'ai.loadingModels': 'Modeller yükleniyor...',
  'ai.noModelsConnected': 'Bağlı model yok',
  'ai.quickAction.loginScreen': 'Summarize this workspace',
  'ai.quickAction.loginScreenPrompt':
    'Summarize the current workspace and the main items visible in the document context.',
  'ai.quickAction.foodApp': 'Describe the selection',
  'ai.quickAction.foodAppPrompt':
    'Describe the currently selected items and any important structure you notice.',
  'ai.quickAction.bottomNav': 'Suggest next steps',
  'ai.quickAction.bottomNavPrompt':
    'Based on the current workspace, suggest three concrete next steps.',
  'ai.quickAction.colorPalette': 'Explain available agents',
  'ai.quickAction.colorPalettePrompt':
    'Explain which connected agents and MCP tools are available right now and how they could help in this workspace.',

  // ── Code Panel ──
  'code.reactTailwind': 'React + Tailwind',
  'code.htmlCss': 'HTML + CSS',
  'code.cssVariables': 'CSS Variables',
  'code.copyClipboard': 'Panoya kopyala',
  'code.copied': 'Kopyalandı!',
  'code.download': 'Kod dosyasını indir',
  'code.closeCodePanel': 'Kod panelini kapat',
  'code.genCssVars': 'Tüm belge için CSS değişkenleri oluşturuluyor',
  'code.genSelected':
    '{{count}} seçili öge için kod oluşturuluyor',
  'code.genDocument': 'Tüm belge için kod oluşturuluyor',
  'code.aiEnhance': 'AI ile geliştir',
  'code.cancelEnhance': 'Geliştirmeyi iptal et',
  'code.resetEnhance': 'Orijinale sıfırla',
  'code.enhancing': 'AI kodu geliştiriyor...',
  'code.enhanced': 'AI tarafından geliştirildi',

  // ── Save Dialog ──
  'save.saveAs': 'Farklı Kaydet',
  'save.fileName': 'Dosya adı',

  // ── Agent Settings ──
  'agents.title': 'Ajanları ve MCP Kur',
  'agents.agentsOnCanvas': 'Tuvaldeki Ajanlar',
  'agents.mcpIntegrations': 'Terminalde MCP Entegrasyonları',
  'agents.transport': 'Aktarım',
  'agents.port': 'Port',
  'agents.mcpRestart':
    'MCP entegrasyonları terminal yeniden başlatıldıktan sonra etkin olacaktır.',
  'agents.modelCount': '{{count}} model',
  'agents.connectionFailed': 'Bağlantı başarısız',
  'agents.serverError': 'Sunucu hatası {{status}}',
  'agents.failedTo': '{{action}} başarısız',
  'agents.failedToMcp': 'MCP sunucusu {{action}} başarısız',
  'agents.failedTransport': 'Aktarım güncellenemedi',
  'agents.failedMcpTransport': 'MCP aktarımı güncellenemedi',
  'agents.claudeCode': 'Claude Code',
  'agents.claudeModels': 'Claude modelleri',
  'agents.codexCli': 'Codex CLI',
  'agents.openaiModels': 'OpenAI modelleri',
  'agents.opencode': 'OpenCode',
  'agents.opencodeDesc': '75+ LLM sağlayıcı',
  'agents.copilot': 'GitHub Copilot',
  'agents.copilotDesc': 'GitHub Copilot modelleri',
  'agents.mcpServer': 'MCP Sunucu',
  'agents.mcpServerStart': 'Başlat',
  'agents.mcpServerStop': 'Durdur',
  'agents.mcpServerRunning': 'Çalışıyor',
  'agents.mcpServerStopped': 'Durduruldu',
  'agents.mcpLanAccess': 'LAN Erişimi',
  'agents.mcpClientConfig': 'İstemci yapılandırması',
  'agents.stdio': 'stdio',
  'agents.http': 'http',
  'agents.stdioHttp': 'stdio + http',
  'agents.autoUpdate': 'Otomatik güncelleme kontrolü',
  'agents.notInstalled': 'Yüklü değil',
  'agents.install': 'Yükle',
  'agents.installing': 'Yükleniyor...',
  'agents.installFailed': 'Yükleme başarısız',
  'agents.viewDocs': 'Belgeler',

  // ── Figma Import ──
  'figma.title': 'Figma\'dan İçe Aktar',
  'figma.dropFile': 'Bir .fig dosyasını buraya bırakın',
  'figma.orBrowse': 'veya göz atmak için tıklayın',
  'figma.exportTip': 'Figma\'dan dışa aktar: File \u2192 Save local copy (.fig)',
  'figma.selectFigFile': 'Lütfen bir .fig dosyası seçin',
  'figma.noPages': '.fig dosyasında sayfa bulunamadı',
  'figma.parseFailed': '.fig dosyası ayrıştırılamadı',
  'figma.convertFailed': 'Figma dosyası dönüştürülemedi',
  'figma.parsing': '.fig dosyası ayrıştırılıyor...',
  'figma.converting': 'Düğümler dönüştürülüyor...',
  'figma.selectPage':
    'Bu dosyada {{count}} sayfa var. İçe aktarılacakları seçin:',
  'figma.layers': '{{count}} katman',
  'figma.importAll': 'Tüm Sayfaları İçe Aktar',
  'figma.importComplete': 'İçe aktarma tamamlandı!',
  'figma.moreWarnings': '...ve {{count}} uyarı daha',
  'figma.tryAgain': 'Tekrar Dene',
  'figma.layoutMode': 'Düzen modu:',
  'figma.preserveLayout': 'Figma düzenini koru',
  'figma.autoLayout': 'OpenPencil otomatik düzen',
  'figma.comingSoon': 'Yakında',

  // ── Landing Page ──
  'landing.open': 'Game Theory ',
  'landing.pencil': 'Analysis',
  'landing.tagline': 'Manual strategic analysis for two-player games.',
  'landing.newDesign': 'Open Analysis',
  'landing.shortcutHint': 'Press {{key1}} + {{key2}} to start a new analysis',

  // ── 404 ──
  'notFound.message': 'Sayfa bulunamadı',

  // ── Component Browser ──
  'componentBrowser.title': 'UIKit Tarayıcısı',
  'componentBrowser.exportKit': 'Kiti dışa aktar',
  'componentBrowser.importKit': 'Kiti içe aktar',
  'componentBrowser.kit': 'Kit:',
  'componentBrowser.all': 'Tümü',
  'componentBrowser.imported': '(içe aktarılan)',
  'componentBrowser.components': 'bileşen',
  'componentBrowser.searchComponents': 'Bileşen ara...',
  'componentBrowser.deleteKit': '{{name}} sil',
  'componentBrowser.category.all': 'Tümü',
  'componentBrowser.category.buttons': 'Butonlar',
  'componentBrowser.category.inputs': 'Girişler',
  'componentBrowser.category.cards': 'Kartlar',
  'componentBrowser.category.nav': 'Gezinme',
  'componentBrowser.category.layout': 'Düzen',
  'componentBrowser.category.feedback': 'Geri Bildirim',
  'componentBrowser.category.data': 'Veri',
  'componentBrowser.category.other': 'Diğer',

  // ── Variable Picker ──
  'variablePicker.boundTo': '--{{name}} ile bağlı',
  'variablePicker.bindToVariable': 'Değişkene bağla',
  'variablePicker.unbind': 'Değişken bağını kaldır',
  'variablePicker.noVariables': 'Tanımlanmış {{type}} değişkeni yok',
} as const

export default tr
