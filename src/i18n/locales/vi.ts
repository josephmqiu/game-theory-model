import type { TranslationKeys } from "./en";

const vi: TranslationKeys = {
  // ── Common ──
  "common.connect": "Kết nối",
  "common.disconnect": "Ngắt kết nối",
  "common.best": "Tốt nhất",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "Tạo mới",
  "topbar.open": "Mở",
  "topbar.save": "Lưu",
  "topbar.fullscreen": "Toàn màn hình",
  "topbar.exitFullscreen": "Thoát toàn màn hình",
  "topbar.newAnalysis": "Phân tích mới",
  "topbar.unsavedFile": "Tệp .gta chưa lưu",
  "topbar.tooltipNew": "Bắt đầu phân tích mới",
  "topbar.tooltipOpen": "Mở tệp phân tích .gta đã lưu",
  "topbar.tooltipSave": "Lưu phân tích hiện tại",
  "topbar.edited": "— Đã chỉnh sửa",
  "topbar.agentsAndMcp": "Agent & MCP",
  "topbar.setupAgentsMcp": "Thiết lập Agent & MCP",
  "topbar.connected": "đã kết nối",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "Cập nhật phần mềm",
  "updater.dismiss": "Bỏ qua",
  "updater.current": "Hiện tại",
  "updater.latest": "Mới nhất",
  "updater.unknown": "Không rõ",
  "updater.checking": "Đang kiểm tra...",
  "updater.downloadProgress": "Tiến trình tải xuống",
  "updater.checkAgain": "Kiểm tra lại",
  "updater.restartInstall": "Khởi động lại & Cài đặt",
  "updater.installing": "Đang cài đặt...",
  "updater.releaseDate": "Ngày phát hành: {{date}}",
  "updater.restartHint":
    "Khởi động lại để áp dụng bản cập nhật. Quá trình khởi động lại thường mất 10-15 giây.",
  "updater.unknownError": "Lỗi cập nhật không xác định.",
  "updater.title.checking": "Đang kiểm tra bản cập nhật",
  "updater.title.available": "Đã tìm thấy bản cập nhật",
  "updater.title.downloading": "Đang tải bản cập nhật",
  "updater.title.downloaded": "Sẵn sàng cài đặt",
  "updater.title.error": "Cập nhật thất bại",
  "updater.subtitle.checking": "Đang tìm bản phát hành mới nhất...",
  "updater.subtitle.available": "Phiên bản {{version}} đã sẵn sàng.",
  "updater.subtitle.availableGeneric": "Đã có phiên bản mới.",
  "updater.subtitle.downloading":
    "Phiên bản {{version}} đang được tải xuống trong nền.",
  "updater.subtitle.downloadingGeneric": "Đang tải gói cập nhật trong nền.",
  "updater.subtitle.downloaded": "Phiên bản {{version}} đã được tải xuống.",
  "updater.subtitle.downloadedGeneric": "Bản cập nhật đã được tải xuống.",
  "updater.subtitle.error": "Không thể kiểm tra hoặc tải bản cập nhật.",

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
  "ai.newChat": "Cuộc trò chuyện mới",
  "ai.collapse": "Thu gọn",
  "ai.generating": "Đang tạo...",
  "ai.stopGenerating": "Dừng tạo",
  "ai.sendMessage": "Gửi tin nhắn",
  "ai.loadingModels": "Đang tải mô hình...",
  "ai.noModelsConnected": "Chưa kết nối mô hình nào",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "Thiết lập Agent & MCP",
  "agents.agentsOnCanvas": "Agent trên Canvas",
  "agents.mcpIntegrations": "Tích hợp MCP trong Terminal",
  "agents.port": "Cổng",
  "agents.mcpRestart":
    "Các tích hợp MCP sẽ có hiệu lực sau khi khởi động lại terminal.",
  "agents.modelCount": "{{count}} mô hình",
  "agents.connectionFailed": "Kết nối thất bại",
  "agents.serverError": "Lỗi máy chủ {{status}}",
  "agents.failedTo": "Không thể {{action}}",
  "agents.failedToMcp": "Không thể {{action}} máy chủ MCP",
  "agents.claudeModels": "Các mô hình Claude",
  "agents.openaiModels": "Các mô hình OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ nhà cung cấp LLM",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "Các mô hình GitHub Copilot",
  "agents.mcpServer": "Máy chủ MCP",
  "agents.mcpServerStop": "Dừng",
  "agents.mcpServerRunning": "Đang chạy",
  "agents.mcpServerStopped": "Đã dừng",
  "agents.mcpClientConfig": "Cấu hình client",
  "agents.autoUpdate": "Tự động kiểm tra cập nhật",
  "agents.notInstalled": "Chưa cài đặt",
  "agents.install": "Cài đặt",
  "agents.installing": "Đang cài đặt...",
  "agents.installFailed": "Cài đặt thất bại",
  "agents.viewDocs": "Tài liệu",
  "agents.analysisRuntime": "Môi trường phân tích",
  "agents.analysisWebSearch": "Tìm kiếm web",
  "agents.analysisWebSearchHint":
    "Sử dụng nghiên cứu web trực tiếp trong quá trình phân tích.",
  "agents.analysisEffort": "Mức độ phân tích",
  "agents.analysisEffortHint":
    "Kiểm soát hướng dẫn độ sâu phân tích cho các lần chạy, không phải lựa chọn mô hình.",
  "agents.analysisEffortQuick": "Nhanh",
  "agents.analysisEffortStandard": "Tiêu chuẩn",
  "agents.analysisEffortThorough": "Kỹ lưỡng",
  "agents.analysisPhases": "Chọn giai đoạn",
  "agents.analysisPhasesHint":
    "Chạy giai đoạn tùy chỉnh chỉ chạy các giai đoạn đã chọn và có thể tắt xác thực lại tự động hạ nguồn.",
  "agents.analysisPhasesAll": "Tất cả giai đoạn",
  "agents.analysisPhasesCustom": "Tùy chỉnh",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Không tìm thấy trang",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "Nhà phân tích Lý thuyết trò chơi",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "Không thể đổi mô hình khi đang phân tích. Hãy dừng phân tích trước.",
  "analysis.unsavedChanges":
    "Bạn có thay đổi phân tích chưa lưu. Bỏ chúng và bắt đầu phân tích mới?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "Đang chuẩn bị phân tích giai đoạn.",
  "analysis.activity.researching": "Đang nghiên cứu bằng chứng.",
  "analysis.activity.synthesizing": "Đang tổng hợp kết quả giai đoạn.",
  "analysis.activity.validating": "Đang xác thực kết quả có cấu trúc.",
  "analysis.activity.retrying":
    "Đang thử lại giai đoạn sau lỗi xác thực hoặc truyền tải.",
  "analysis.activity.default": "Đang tiếp tục phân tích giai đoạn.",
  "analysis.activity.usingTool": "Đang sử dụng {{toolName}}",
  "analysis.activity.usingWebSearchQuery":
    "Đang sử dụng WebSearch: {{query}}",
  "analysis.activity.agentProgress": "Tiến trình agent",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Giai đoạn {{number}} thất bại",
  "analysis.progress.phaseLabel": "Giai đoạn {{number}}: {{name}}",
  "analysis.progress.phasesComplete":
    "{{completed}}/{{total}} giai đoạn hoàn tất",
  "analysis.progress.entityCount": "{{count}} thực thể",
  "analysis.progress.entityCountPlural": "{{count}} thực thể",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "hết thời gian",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "lỗi nhà cung cấp",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "Nền tảng tình huống",
  "analysis.phases.playerIdentification": "Xác định người chơi",
  "analysis.phases.baselineModel": "Mô hình cơ sở",
  "analysis.phases.historicalGame": "Trò chơi lịch sử",
  "analysis.phases.revalidation": "Xác thực lại",
  "analysis.phases.formalModeling": "Mô hình hóa hình thức",
  "analysis.phases.assumptions": "Giả định",
  "analysis.phases.elimination": "Loại trừ",
  "analysis.phases.scenarios": "Kịch bản",
  "analysis.phases.metaCheck": "Kiểm tra tổng hợp",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "Chạy lại giai đoạn",
  "analysis.sidebar.searchEntities": "Tìm thực thể...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "Sự kiện",
  "analysis.entities.player": "Người chơi",
  "analysis.entities.objective": "Mục tiêu",
  "analysis.entities.game": "Trò chơi",
  "analysis.entities.strategy": "Chiến lược",
  "analysis.entities.payoff": "Phần thưởng",
  "analysis.entities.rule": "Quy tắc",
  "analysis.entities.escalation": "Leo thang",
  "analysis.entities.history": "Lịch sử",
  "analysis.entities.pattern": "Mẫu hình",
  "analysis.entities.trust": "Tin cậy",
  "analysis.entities.commitment": "Cam kết",
  "analysis.entities.signal": "Tín hiệu",
  "analysis.entities.matrix": "Ma trận",
  "analysis.entities.gameTree": "Cây trò chơi",
  "analysis.entities.equilibrium": "Cân bằng",
  "analysis.entities.constraints": "Ràng buộc",
  "analysis.entities.crossGame": "Liên trò chơi",
  "analysis.entities.signalClass": "Lớp tín hiệu",
  "analysis.entities.bargaining": "Thương lượng",
  "analysis.entities.optionValue": "Giá trị quyền chọn",
  "analysis.entities.behavioral": "Hành vi",
  "analysis.entities.assumption": "Giả định",
  "analysis.entities.eliminated": "Đã loại",
  "analysis.entities.scenario": "Kịch bản",
  "analysis.entities.thesis": "Luận điểm",
  "analysis.entities.metaCheck": "Kiểm tra tổng hợp",
  "analysis.entities.confidence.high": "Cao",
  "analysis.entities.confidence.medium": "Trung bình",
  "analysis.entities.confidence.low": "Thấp",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "Con người",
} as const;

export default vi;
