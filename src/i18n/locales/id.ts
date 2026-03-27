import type { TranslationKeys } from "./en";

const id: TranslationKeys = {
  // ── Common ──
  "common.rename": "Ubah Nama",
  "common.duplicate": "Duplikat",
  "common.delete": "Hapus",
  "common.cancel": "Batal",
  "common.save": "Simpan",
  "common.close": "Tutup",
  "common.connect": "Hubungkan",
  "common.disconnect": "Putuskan",
  "common.import": "Impor",
  "common.export": "Ekspor",
  "common.name": "Nama",
  "common.untitled": "Tanpa Judul",
  "common.best": "Terbaik",
  "common.selected": "{{count}} dipilih",

  // ── Toolbar ──
  "toolbar.select": "Pilih",
  "toolbar.text": "Teks",
  "toolbar.frame": "Frame",
  "toolbar.hand": "Tangan",
  "toolbar.undo": "Urungkan",
  "toolbar.redo": "Ulangi",
  "toolbar.variables": "Variabel",
  "toolbar.uikitBrowser": "Penjelajah UIKit",

  // ── Shapes ──
  "shapes.rectangle": "Persegi Panjang",
  "shapes.ellipse": "Elips",
  "shapes.polygon": "Poligon",
  "shapes.line": "Garis",
  "shapes.icon": "Ikon",
  "shapes.importImageSvg": "Impor Gambar atau SVG\u2026",
  "shapes.pen": "Pena",
  "shapes.shapeTools": "Alat bentuk",
  "shapes.moreShapeTools": "Alat bentuk lainnya",

  // ── Top Bar ──
  "topbar.hideLayers": "Sembunyikan kerangka",
  "topbar.showLayers": "Tampilkan kerangka",
  "topbar.new": "Baru",
  "topbar.open": "Buka",
  "topbar.save": "Simpan",
  "topbar.importFigma": "Impor Figma",
  "topbar.codePanel": "Kode",
  "topbar.fullscreen": "Layar penuh",
  "topbar.exitFullscreen": "Keluar layar penuh",
  "topbar.newAnalysis": "Analisis Baru",
  "topbar.unsavedFile": "File .gta belum disimpan",
  "topbar.complete": "Selesai",
  "topbar.incomplete": "{{count}} sel tersisa",
  "topbar.issues": "{{count}} masalah",
  "topbar.tooltipNew": "Mulai analisis baru",
  "topbar.tooltipOpen": "Buka analisis .gta tersimpan",
  "topbar.tooltipSave": "Simpan analisis saat ini",
  "topbar.edited": "— Diedit",
  "topbar.agentsAndMcp": "Agent & MCP",
  "topbar.setupAgentsMcp": "Pengaturan Agent & MCP",
  "topbar.connected": "terhubung",
  "topbar.agentStatus": "{{agents}} agent{{agentSuffix}} · {{mcp}} MCP",

  // ── Right Panel ──
  "rightPanel.design": "Detail",
  "rightPanel.code": "Kode",
  "rightPanel.noSelection": "Pilih sebuah item",

  // ── Pages ──
  "pages.title": "Halaman",
  "pages.addPage": "Tambah halaman",
  "pages.moveUp": "Pindah ke Atas",
  "pages.moveDown": "Pindah ke Bawah",

  // ── Status Bar ──
  "statusbar.zoomOut": "Perkecil",
  "statusbar.zoomIn": "Perbesar",
  "statusbar.resetZoom": "Atur ulang zoom",

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
  "layers.title": "Kerangka",
  "layers.empty": "Belum ada item. Gunakan bilah alat untuk mulai membangun.",

  // ── Layer Context Menu ──
  "layerMenu.groupSelection": "Kelompokkan Pilihan",
  "layerMenu.createComponent": "Buat Komponen",
  "layerMenu.detachComponent": "Lepaskan Komponen",
  "layerMenu.detachInstance": "Lepaskan Instance",
  "layerMenu.booleanUnion": "Gabungan",
  "layerMenu.booleanSubtract": "Kurangi",
  "layerMenu.booleanIntersect": "Irisan",
  "layerMenu.toggleLock": "Alihkan Kunci",
  "layerMenu.toggleVisibility": "Alihkan Visibilitas",

  // ── Property Panel ──
  "property.createComponent": "Buat Komponen",
  "property.detachComponent": "Lepaskan Komponen",
  "property.goToComponent": "Buka komponen",
  "property.detachInstance": "Lepaskan instance",

  // ── Fill ──
  "fill.title": "Isi",
  "fill.solid": "Solid",
  "fill.linear": "Linear",
  "fill.radial": "Radial",
  "fill.image": "Gambar",
  "fill.stops": "Titik warna",
  "fill.angle": "Sudut",

  // ── Image ──
  "image.title": "Gambar",
  "image.fit": "Mode Penyesuaian",
  "image.fill": "Isi",
  "image.fitMode": "Sesuaikan",
  "image.crop": "Potong",
  "image.tile": "Ubin",
  "image.clickToUpload": "Klik untuk mengunggah",
  "image.changeImage": "Ganti gambar",
  "image.adjustments": "Penyesuaian",
  "image.exposure": "Eksposur",
  "image.contrast": "Kontras",
  "image.saturation": "Saturasi",
  "image.temperature": "Suhu",
  "image.tint": "Rona",
  "image.highlights": "Sorotan",
  "image.shadows": "Bayangan",
  "image.reset": "Atur ulang",

  // ── Stroke ──
  "stroke.title": "Garis Tepi",

  // ── Appearance ──
  "appearance.layer": "Layer",
  "appearance.opacity": "Opasitas",

  // ── Layout ──
  "layout.flexLayout": "Tata Letak Flex",
  "layout.freedom": "Bebas (tanpa tata letak)",
  "layout.vertical": "Tata letak vertikal",
  "layout.horizontal": "Tata letak horizontal",
  "layout.alignment": "Perataan",
  "layout.gap": "Jarak",
  "layout.spaceBetween": "Space Between",
  "layout.spaceAround": "Space Around",
  "layout.dimensions": "Dimensi",
  "layout.fillWidth": "Isi Lebar",
  "layout.fillHeight": "Isi Tinggi",
  "layout.hugWidth": "Rangkul Lebar",
  "layout.hugHeight": "Rangkul Tinggi",
  "layout.clipContent": "Potong Konten",

  // ── Padding ──
  "padding.title": "Padding",
  "padding.paddingMode": "Mode padding",
  "padding.paddingValues": "Nilai Padding",
  "padding.oneValue": "Satu nilai untuk semua sisi",
  "padding.horizontalVertical": "Horizontal/Vertikal",
  "padding.topRightBottomLeft": "Atas/Kanan/Bawah/Kiri",

  // ── Typography ──
  "text.typography": "Tipografi",
  "text.lineHeight": "Tinggi baris",
  "text.letterSpacing": "Jarak huruf",
  "text.horizontal": "Horizontal",
  "text.vertical": "Vertikal",
  "text.alignLeft": "Rata kiri",
  "text.alignCenter": "Rata tengah",
  "text.alignRight": "Rata kanan",
  "text.justify": "Rata kiri-kanan",
  "text.top": "Atas",
  "text.middle": "Tengah",
  "text.bottom": "Bawah",
  "text.weight.thin": "Tipis",
  "text.weight.light": "Ringan",
  "text.weight.regular": "Reguler",
  "text.weight.medium": "Sedang",
  "text.weight.semibold": "Semi Tebal",
  "text.weight.bold": "Tebal",
  "text.weight.black": "Sangat Tebal",
  "text.font.search": "Cari font\u2026",
  "text.font.bundled": "Bawaan",
  "text.font.system": "Sistem",
  "text.font.loading": "Memuat font\u2026",
  "text.font.noResults": "Font tidak ditemukan",

  // ── Text Layout ──
  "textLayout.title": "Tata Letak",
  "textLayout.dimensions": "Dimensi",
  "textLayout.resizing": "Pengubahan ukuran",
  "textLayout.autoWidth": "Auto L",
  "textLayout.autoWidthDesc":
    "Lebar Otomatis \u2014 teks meluas secara horizontal",
  "textLayout.autoHeight": "Auto T",
  "textLayout.autoHeightDesc":
    "Tinggi Otomatis \u2014 lebar tetap, tinggi menyesuaikan otomatis",
  "textLayout.fixed": "Tetap",
  "textLayout.fixedDesc": "Ukuran Tetap \u2014 lebar dan tinggi tetap",
  "textLayout.fillWidth": "Isi Lebar",
  "textLayout.fillHeight": "Isi Tinggi",

  // ── Effects ──
  "effects.title": "Efek",
  "effects.dropShadow": "Bayangan jatuh",
  "effects.blur": "Blur",
  "effects.spread": "Sebaran",
  "effects.color": "Warna",

  // ── Export ──
  "export.title": "Ekspor",
  "export.format": "Format",
  "export.scale": "Skala",
  "export.selectedOnly": "Ekspor pilihan saja",
  "export.exportFormat": "Ekspor {{format}}",
  "export.exportLayer": "Ekspor layer",

  // ── Polygon ──
  "polygon.sides": "Sisi",

  // ── Ellipse ──
  "ellipse.start": "Mulai",
  "ellipse.sweep": "Sapuan",
  "ellipse.innerRadius": "Dalam",

  // ── Corner Radius ──
  "cornerRadius.title": "Radius Sudut",

  // ── Size / Position ──
  "size.position": "Posisi",

  // ── Icon ──
  "icon.title": "Ikon",
  "icon.searchIcons": "Cari ikon...",
  "icon.noIconsFound": "Ikon tidak ditemukan",
  "icon.typeToSearch": "Ketik untuk mencari ikon Iconify",
  "icon.iconsCount": "{{count}} ikon",

  // ── Variables Panel ──
  "variables.addTheme": "Tambah tema",
  "variables.addVariant": "Tambah varian",
  "variables.addVariable": "Tambah variabel",
  "variables.searchVariables": "Cari variabel...",
  "variables.noMatch": "Tidak ada variabel yang cocok dengan pencarian",
  "variables.noDefined": "Belum ada variabel yang didefinisikan",
  "variables.closeShortcut": "Tutup (\u2318\u21e7V)",
  "variables.presets": "Preset",
  "variables.savePreset": "Simpan saat ini sebagai preset…",
  "variables.loadPreset": "Muat preset",
  "variables.importPreset": "Impor dari file…",
  "variables.exportPreset": "Ekspor ke file…",
  "variables.presetName": "Nama preset",
  "variables.noPresets": "Tidak ada preset tersimpan",

  // ── AI Chat ──
  "ai.newChat": "Chat baru",
  "ai.collapse": "Ciutkan",
  "ai.tryExample": "Coba prompt ruang kerja...",
  "ai.tipSelectElements":
    "Tips: Pilih item di ruang kerja sebelum mengobrol untuk konteks.",
  "ai.generating": "Membuat...",
  "ai.designWithAgent": "Tanyakan agent tentang ruang kerja ini...",
  "ai.attachImage": "Lampirkan gambar",
  "ai.stopGenerating": "Hentikan pembuatan",
  "ai.sendMessage": "Kirim pesan",
  "ai.loadingModels": "Memuat model...",
  "ai.noModelsConnected": "Tidak ada model terhubung",
  "ai.quickAction.loginScreen": "Rangkum ruang kerja ini",
  "ai.quickAction.loginScreenPrompt":
    "Rangkum ruang kerja saat ini dan item utama yang terlihat dalam konteks dokumen.",
  "ai.quickAction.foodApp": "Jelaskan pilihan",
  "ai.quickAction.foodAppPrompt":
    "Jelaskan item yang sedang dipilih dan struktur penting yang Anda perhatikan.",
  "ai.quickAction.bottomNav": "Sarankan langkah selanjutnya",
  "ai.quickAction.bottomNavPrompt":
    "Berdasarkan ruang kerja saat ini, sarankan tiga langkah konkret selanjutnya.",
  "ai.quickAction.colorPalette": "Jelaskan agent yang tersedia",
  "ai.quickAction.colorPalettePrompt":
    "Jelaskan agent dan alat MCP yang terhubung saat ini dan bagaimana mereka dapat membantu di ruang kerja ini.",

  // ── Code Panel ──
  "code.reactTailwind": "React + Tailwind",
  "code.htmlCss": "HTML + CSS",
  "code.cssVariables": "CSS Variables",
  "code.copyClipboard": "Salin ke papan klip",
  "code.copied": "Tersalin!",
  "code.download": "Unduh file kode",
  "code.closeCodePanel": "Tutup panel kode",
  "code.genCssVars": "Membuat CSS variables untuk seluruh dokumen",
  "code.genSelected": "Membuat kode untuk {{count}} elemen yang dipilih",
  "code.genDocument": "Membuat kode untuk seluruh dokumen",
  "code.aiEnhance": "Tingkatkan dengan AI",
  "code.cancelEnhance": "Batalkan peningkatan",
  "code.resetEnhance": "Kembalikan ke asli",
  "code.enhancing": "AI sedang meningkatkan kode...",
  "code.enhanced": "Ditingkatkan oleh AI",

  // ── Save Dialog ──
  "save.saveAs": "Simpan Sebagai",
  "save.fileName": "Nama file",

  // ── Agent Settings ──
  "agents.title": "Pengaturan Agent & MCP",
  "agents.agentsOnCanvas": "Agent di Canvas",
  "agents.mcpIntegrations": "Integrasi MCP di Terminal",
  "agents.transport": "Transport",
  "agents.port": "Port",
  "agents.mcpRestart":
    "Integrasi MCP akan berlaku setelah terminal dimulai ulang.",
  "agents.modelCount": "{{count}} model",
  "agents.connectionFailed": "Koneksi gagal",
  "agents.serverError": "Kesalahan server {{status}}",
  "agents.failedTo": "Gagal {{action}}",
  "agents.failedToMcp": "Gagal {{action}} server MCP",
  "agents.failedTransport": "Gagal memperbarui transport",
  "agents.failedMcpTransport": "Gagal memperbarui transport MCP",
  "agents.claudeCode": "Claude Code",
  "agents.claudeModels": "Model Claude",
  "agents.codexCli": "Codex CLI",
  "agents.openaiModels": "Model OpenAI",
  "agents.mcpServer": "Server MCP",
  "agents.mcpServerStart": "Mulai",
  "agents.mcpServerStop": "Hentikan",
  "agents.mcpServerRunning": "Berjalan",
  "agents.mcpServerStopped": "Berhenti",
  "agents.mcpLanAccess": "Akses LAN",
  "agents.mcpClientConfig": "Konfigurasi klien",
  "agents.stdio": "stdio",
  "agents.http": "http",
  "agents.stdioHttp": "stdio + http",
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

  // ── Figma Import ──
  "figma.title": "Impor dari Figma",
  "figma.dropFile": "Letakkan file .fig di sini",
  "figma.orBrowse": "atau klik untuk menjelajah",
  "figma.exportTip": "Ekspor dari Figma: File \u2192 Save local copy (.fig)",
  "figma.selectFigFile": "Silakan pilih file .fig",
  "figma.noPages": "Tidak ada halaman ditemukan di file .fig",
  "figma.parseFailed": "Gagal mengurai file .fig",
  "figma.convertFailed": "Gagal mengonversi file Figma",
  "figma.parsing": "Mengurai file .fig...",
  "figma.converting": "Mengonversi node...",
  "figma.selectPage":
    "File ini memiliki {{count}} halaman. Pilih yang akan diimpor:",
  "figma.layers": "{{count}} layer",
  "figma.importAll": "Impor Semua Halaman",
  "figma.importComplete": "Impor selesai!",
  "figma.moreWarnings": "...dan {{count}} peringatan lainnya",
  "figma.tryAgain": "Coba Lagi",
  "figma.layoutMode": "Mode tata letak:",
  "figma.preserveLayout": "Pertahankan tata letak Figma",
  "figma.autoLayout": "Tata letak otomatis OpenPencil",
  "figma.comingSoon": "Segera hadir",

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Halaman tidak ditemukan",

  // ── Component Browser ──
  "componentBrowser.title": "Penjelajah UIKit",
  "componentBrowser.exportKit": "Ekspor kit",
  "componentBrowser.importKit": "Impor kit",
  "componentBrowser.kit": "Kit:",
  "componentBrowser.all": "Semua",
  "componentBrowser.imported": "(diimpor)",
  "componentBrowser.components": "komponen",
  "componentBrowser.searchComponents": "Cari komponen...",
  "componentBrowser.deleteKit": "Hapus {{name}}",
  "componentBrowser.category.all": "Semua",
  "componentBrowser.category.buttons": "Tombol",
  "componentBrowser.category.inputs": "Input",
  "componentBrowser.category.cards": "Kartu",
  "componentBrowser.category.nav": "Navigasi",
  "componentBrowser.category.layout": "Tata Letak",
  "componentBrowser.category.feedback": "Umpan Balik",
  "componentBrowser.category.data": "Data",
  "componentBrowser.category.other": "Lainnya",

  // ── Variable Picker ──
  "variablePicker.boundTo": "Terikat ke --{{name}}",
  "variablePicker.bindToVariable": "Ikat ke variabel",
  "variablePicker.unbind": "Lepaskan variabel",
  "variablePicker.noVariables":
    "Belum ada variabel {{type}} yang didefinisikan",

  // ── Analysis ──
  "analysis.title": "Analis Teori Permainan",
  "analysis.emptyState":
    "Saya analis teori permainan Anda. Peristiwa apa yang ingin Anda analisis?",
  "analysis.emptyHint":
    "Saya akan mengidentifikasi pemain, strategi, dan struktur permainan secara otomatis.",
  "analysis.inputPlaceholder": "Deskripsikan peristiwa untuk dianalisis...",
  "analysis.startingAnalysis":
    'Memulai analisis teori permainan untuk "{{topic}}"...',
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
  "analysis.activity.usingWebSearchQuery": "Menggunakan WebSearch: {{query}}",
  "analysis.activity.agentProgress": "Progres agent",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Fase {{number}} gagal",
  "analysis.progress.phaseLabel": "Fase {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} fase selesai",
  "analysis.progress.entityCount": "{{count}} entitas",
  "analysis.progress.entityCountPlural": "{{count}} entitas",

  // ── Analysis Failures ──
  "analysis.failure.timeout": "waktu habis",
  "analysis.failure.parseError": "kesalahan parsing",
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
  "analysis.entities.noMatching": "Tidak ada entitas yang cocok",
  "analysis.entities.searchHint":
    "Coba kata kunci lain atau hapus filter tipe.",
  "analysis.entities.confidence.high": "Tinggi",
  "analysis.entities.confidence.medium": "Sedang",
  "analysis.entities.confidence.low": "Rendah",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "Manusia",
  "analysis.entities.source.computed": "Komputasi",
} as const;

export default id;
