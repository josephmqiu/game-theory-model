import type { TranslationKeys } from "./en";

const tr: TranslationKeys = {
  // ── Common ──
  "common.connect": "Bağlan",
  "common.disconnect": "Bağlantıyı Kes",
  "common.best": "En İyi",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "Yeni",
  "topbar.open": "Aç",
  "topbar.save": "Kaydet",
  "topbar.fullscreen": "Tam ekran",
  "topbar.exitFullscreen": "Tam ekrandan çık",
  "topbar.newAnalysis": "Yeni Analiz",
  "topbar.unsavedFile": "Kaydedilmemiş .gta dosyası",
  "topbar.tooltipNew": "Yeni bir analiz başlat",
  "topbar.tooltipOpen": "Kayıtlı bir .gta analizi aç",
  "topbar.tooltipSave": "Mevcut analizi kaydet",
  "topbar.edited": "— Düzenlendi",
  "topbar.agentsAndMcp": "Ajanlar ve MCP",
  "topbar.setupAgentsMcp": "Ajanları ve MCP Kur",
  "topbar.connected": "bağlı",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

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
  "ai.newChat": "Yeni sohbet",
  "ai.collapse": "Daralt",
  "ai.generating": "Oluşturuluyor...",
  "ai.stopGenerating": "Oluşturmayı durdur",
  "ai.sendMessage": "Mesaj gönder",
  "ai.loadingModels": "Modeller yükleniyor...",
  "ai.noModelsConnected": "Bağlı model yok",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "Ajanları ve MCP Kur",
  "agents.agentsOnCanvas": "Tuvaldeki Ajanlar",
  "agents.mcpIntegrations": "Terminalde MCP Entegrasyonları",
  "agents.port": "Port",
  "agents.mcpRestart":
    "MCP entegrasyonları terminal yeniden başlatıldıktan sonra etkin olacaktır.",
  "agents.modelCount": "{{count}} model",
  "agents.connectionFailed": "Bağlantı başarısız",
  "agents.serverError": "Sunucu hatası {{status}}",
  "agents.failedTo": "{{action}} başarısız",
  "agents.failedToMcp": "MCP sunucusu {{action}} başarısız",
  "agents.claudeModels": "Claude modelleri",
  "agents.openaiModels": "OpenAI modelleri",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ LLM sağlayıcı",
  "agents.mcpServer": "MCP Sunucu",
  "agents.mcpServerStop": "Durdur",
  "agents.mcpServerRunning": "Çalışıyor",
  "agents.mcpServerStopped": "Durduruldu",
  "agents.mcpClientConfig": "İstemci yapılandırması",
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

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Sayfa bulunamadı",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "Oyun Teorisi Analisti",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
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
  "analysis.activity.usingWebSearchQuery":
    "WebSearch kullanılıyor: {{query}}",
  "analysis.activity.agentProgress": "Ajan ilerlemesi",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Faz {{number}} başarısız oldu",
  "analysis.progress.phaseLabel": "Faz {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} faz tamamlandı",
  "analysis.progress.entityCount": "{{count}} varlık",
  "analysis.progress.entityCountPlural": "{{count}} varlık",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "zaman aşımı",
  "analysis.failure.unknown": "unknown error",
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
  "analysis.entities.confidence.high": "Yüksek",
  "analysis.entities.confidence.medium": "Orta",
  "analysis.entities.confidence.low": "Düşük",
  "analysis.entities.source.ai": "Yapay Zeka",
  "analysis.entities.source.human": "İnsan",
} as const;

export default tr;
