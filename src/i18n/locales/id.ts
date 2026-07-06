import type { TranslationKeys } from "./en";

const id: TranslationKeys = {
  // ── Common ──
  "common.connect": "Hubungkan",
  "common.disconnect": "Putuskan",
  "common.best": "Terbaik",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "Baru",
  "topbar.open": "Buka",
  "topbar.save": "Simpan",
  "topbar.fullscreen": "Layar penuh",
  "topbar.exitFullscreen": "Keluar layar penuh",
  "topbar.newAnalysis": "Analisis Baru",
  "topbar.unsavedFile": "File .gta belum disimpan",
  "topbar.tooltipNew": "Mulai analisis baru",
  "topbar.tooltipOpen": "Buka analisis .gta tersimpan",
  "topbar.tooltipSave": "Simpan analisis saat ini",
  "topbar.edited": "— Diedit",
  "topbar.agentsAndMcp": "Agent & MCP",
  "topbar.setupAgentsMcp": "Pengaturan Agent & MCP",
  "topbar.connected": "terhubung",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "Pembaruan Perangkat Lunak",
  "updater.dismiss": "Tutup",
  "updater.current": "Saat ini",
  "updater.latest": "Terbaru",
  "updater.unknown": "Tidak diketahui",
  "updater.checking": "Memeriksa...",
  "updater.downloadProgress": "Progres Unduhan",
  "updater.checkAgain": "Periksa Lagi",
  "updater.restartInstall": "Mulai Ulang & Pasang",
  "updater.installing": "Memasang...",
  "updater.releaseDate": "Tanggal rilis: {{date}}",
  "updater.restartHint":
    "Mulai ulang untuk menerapkan pembaruan. Proses mulai ulang biasanya memakan waktu 10-15 detik.",
  "updater.unknownError": "Kesalahan pembaruan tidak diketahui.",
  "updater.title.checking": "Memeriksa pembaruan",
  "updater.title.available": "Pembaruan ditemukan",
  "updater.title.downloading": "Mengunduh pembaruan",
  "updater.title.downloaded": "Siap dipasang",
  "updater.title.error": "Pembaruan gagal",
  "updater.subtitle.checking": "Mencari rilis terbaru...",
  "updater.subtitle.available": "Versi {{version}} tersedia.",
  "updater.subtitle.availableGeneric": "Versi baru tersedia.",
  "updater.subtitle.downloading":
    "Versi {{version}} sedang diunduh di latar belakang.",
  "updater.subtitle.downloadingGeneric":
    "Paket pembaruan sedang diunduh di latar belakang.",
  "updater.subtitle.downloaded": "Versi {{version}} telah diunduh.",
  "updater.subtitle.downloadedGeneric": "Pembaruan telah diunduh.",
  "updater.subtitle.error": "Tidak dapat memeriksa atau mengunduh pembaruan.",

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
  "ai.newChat": "Chat baru",
  "ai.collapse": "Ciutkan",
  "ai.generating": "Membuat...",
  "ai.stopGenerating": "Hentikan pembuatan",
  "ai.sendMessage": "Kirim pesan",
  "ai.loadingModels": "Memuat model...",
  "ai.noModelsConnected": "Tidak ada model terhubung",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "Pengaturan Agent & MCP",
  "agents.agentsOnCanvas": "Agent di Canvas",
  "agents.mcpIntegrations": "Integrasi MCP di Terminal",
  "agents.port": "Port",
  "agents.mcpRestart":
    "Integrasi MCP akan berlaku setelah terminal dimulai ulang.",
  "agents.modelCount": "{{count}} model",
  "agents.connectionFailed": "Koneksi gagal",
  "agents.serverError": "Kesalahan server {{status}}",
  "agents.failedTo": "Gagal {{action}}",
  "agents.failedToMcp": "Gagal {{action}} server MCP",
  "agents.claudeModels": "Model Claude",
  "agents.openaiModels": "Model OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ penyedia LLM",
  "agents.mcpServer": "Server MCP",
  "agents.mcpServerStop": "Hentikan",
  "agents.mcpServerRunning": "Berjalan",
  "agents.mcpServerStopped": "Berhenti",
  "agents.mcpClientConfig": "Konfigurasi klien",
  "agents.autoUpdate": "Periksa pembaruan otomatis",
  "agents.notInstalled": "Belum terpasang",
  "agents.install": "Pasang",
  "agents.installing": "Memasang...",
  "agents.installFailed": "Pemasangan gagal",
  "agents.viewDocs": "Dokumen",
  "agents.analysisRuntime": "Runtime Analisis",
  "agents.analysisWebSearch": "Pencarian web",
  "agents.analysisWebSearchHint":
    "Gunakan riset web langsung selama proses analisis.",
  "agents.analysisEffort": "Kedalaman analisis",
  "agents.analysisEffortHint":
    "Mengontrol panduan kedalaman analisis untuk proses analisis, bukan pemilihan model.",
  "agents.analysisEffortQuick": "Cepat",
  "agents.analysisEffortStandard": "Standar",
  "agents.analysisEffortThorough": "Menyeluruh",
  "agents.analysisPhases": "Pemilihan fase",
  "agents.analysisPhasesHint":
    "Proses fase kustom hanya menjalankan fase yang dipilih dan dapat menonaktifkan validasi ulang hilir otomatis.",
  "agents.analysisPhasesAll": "Semua fase",
  "agents.analysisPhasesCustom": "Kustom",
  "agents.customProvider": "API Kustom",
  "agents.customProviderDesc": "Endpoint apa pun yang kompatibel dengan OpenAI — OpenCode Go/Zen, OpenRouter, DeepSeek, atau URL Anda sendiri",
  "agents.customPreset": "Preset penyedia",
  "agents.customBaseUrl": "URL dasar",
  "agents.customApiKey": "Kunci API",
  "agents.customModelIds": "ID model (dipisahkan koma, opsional)",
  "agents.customNativeSearch": "Model memiliki pencarian web bawaan",
  "agents.customNativeSearchHint": "Saat aktif, alat pencarian web aplikasi tidak ditawarkan ke endpoint ini",
  "agents.customModels": "Model kustom",
  "agents.searchProvider": "Penyedia pencarian",
  "agents.searchApiKey": "Kunci API pencarian",
  "agents.searchKeyHint": "Riset web langsung memerlukan kunci penyedia pencarian (Tavily atau Brave)",
  "agents.customKeyStoredPlain": "Browser ini menyimpan kunci tanpa enkripsi. Gunakan aplikasi desktop untuk penyimpanan terenkripsi.",
  "agents.customKeyNotEncrypted": "Enkripsi OS tidak tersedia; kunci tidak disimpan. Aktifkan keychain sistem Anda dan coba lagi.",
  "agents.customConnect": "Hubungkan",
  "agents.searchProviderNone": "Tidak ada",
  "agents.customClearKey": "Hapus kunci API",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Halaman tidak ditemukan",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "Analis Teori Permainan",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "Tidak dapat mengubah model saat analisis berjalan. Hentikan analisis terlebih dahulu.",
  "analysis.unsavedChanges":
    "Anda memiliki perubahan analisis yang belum disimpan. Buang dan mulai analisis baru?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "Mempersiapkan analisis fase.",
  "analysis.activity.researching": "Meneliti bukti.",
  "analysis.activity.synthesizing": "Menyintesis keluaran fase.",
  "analysis.activity.validating": "Memvalidasi keluaran terstruktur.",
  "analysis.activity.retrying":
    "Mencoba ulang fase setelah masalah validasi atau transport.",
  "analysis.activity.default": "Melanjutkan analisis fase.",
  "analysis.activity.usingTool": "Menggunakan {{toolName}}",
  "analysis.activity.usingWebSearchQuery":
    "Menggunakan WebSearch: {{query}}",
  "analysis.activity.agentProgress": "Progres agent",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Fase {{number}} gagal",
  "analysis.progress.phaseLabel": "Fase {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} fase selesai",
  "analysis.progress.entityCount": "{{count}} entitas",
  "analysis.progress.entityCountPlural": "{{count}} entitas",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "waktu habis",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "kesalahan penyedia",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "Landasan Situasional",
  "analysis.phases.playerIdentification": "Identifikasi Pemain",
  "analysis.phases.baselineModel": "Model Dasar",
  "analysis.phases.historicalGame": "Permainan Historis",
  "analysis.phases.revalidation": "Validasi Ulang",
  "analysis.phases.formalModeling": "Pemodelan Formal",
  "analysis.phases.assumptions": "Asumsi",
  "analysis.phases.elimination": "Eliminasi",
  "analysis.phases.scenarios": "Skenario",
  "analysis.phases.metaCheck": "Pemeriksaan Meta",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "Jalankan ulang fase",
  "analysis.sidebar.searchEntities": "Cari entitas...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "Fakta",
  "analysis.entities.player": "Pemain",
  "analysis.entities.objective": "Tujuan",
  "analysis.entities.game": "Permainan",
  "analysis.entities.strategy": "Strategi",
  "analysis.entities.payoff": "Imbalan",
  "analysis.entities.rule": "Aturan",
  "analysis.entities.escalation": "Eskalasi",
  "analysis.entities.history": "Riwayat",
  "analysis.entities.pattern": "Pola",
  "analysis.entities.trust": "Kepercayaan",
  "analysis.entities.commitment": "Komitmen",
  "analysis.entities.signal": "Sinyal",
  "analysis.entities.matrix": "Matriks",
  "analysis.entities.gameTree": "Pohon Permainan",
  "analysis.entities.equilibrium": "Keseimbangan",
  "analysis.entities.constraints": "Kendala",
  "analysis.entities.crossGame": "Lintas Permainan",
  "analysis.entities.signalClass": "Kelas Sinyal",
  "analysis.entities.bargaining": "Tawar-menawar",
  "analysis.entities.optionValue": "Nilai Opsi",
  "analysis.entities.behavioral": "Perilaku",
  "analysis.entities.assumption": "Asumsi",
  "analysis.entities.eliminated": "Tereliminasi",
  "analysis.entities.scenario": "Skenario",
  "analysis.entities.thesis": "Tesis",
  "analysis.entities.metaCheck": "Pemeriksaan Meta",
  "analysis.entities.confidence.high": "Tinggi",
  "analysis.entities.confidence.medium": "Sedang",
  "analysis.entities.confidence.low": "Rendah",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "Manusia",
} as const;

export default id;
