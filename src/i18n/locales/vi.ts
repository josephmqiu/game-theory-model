import type { TranslationKeys } from "./en";

const vi: TranslationKeys = {
  // ── Common ──
  "common.rename": "Đổi tên",
  "common.duplicate": "Nhân bản",
  "common.delete": "Xoá",
  "common.cancel": "Huỷ",
  "common.save": "Lưu",
  "common.close": "Đóng",
  "common.connect": "Kết nối",
  "common.disconnect": "Ngắt kết nối",
  "common.import": "Nhập",
  "common.export": "Xuất",
  "common.name": "Tên",
  "common.untitled": "Chưa đặt tên",
  "common.best": "Tốt nhất",
  "common.selected": "{{count}} đã chọn",

  // ── Toolbar ──
  "toolbar.select": "Chọn",
  "toolbar.text": "Văn bản",
  "toolbar.frame": "Khung",
  "toolbar.hand": "Bàn tay",
  "toolbar.undo": "Hoàn tác",
  "toolbar.redo": "Làm lại",
  "toolbar.variables": "Biến",
  "toolbar.uikitBrowser": "Trình duyệt UIKit",

  // ── Shapes ──
  "shapes.rectangle": "Hình chữ nhật",
  "shapes.ellipse": "Hình elip",
  "shapes.polygon": "Đa giác",
  "shapes.line": "Đường thẳng",
  "shapes.icon": "Biểu tượng",
  "shapes.importImageSvg": "Nhập ảnh hoặc SVG\u2026",
  "shapes.pen": "Bút vẽ",
  "shapes.shapeTools": "Công cụ hình dạng",
  "shapes.moreShapeTools": "Thêm công cụ hình dạng",

  // ── Top Bar ──
  "topbar.hideLayers": "Ẩn đề cương",
  "topbar.showLayers": "Hiện đề cương",
  "topbar.new": "Tạo mới",
  "topbar.open": "Mở",
  "topbar.save": "Lưu",
  "topbar.importFigma": "Nhập từ Figma",
  "topbar.codePanel": "Mã",
  "topbar.fullscreen": "Toàn màn hình",
  "topbar.exitFullscreen": "Thoát toàn màn hình",
  "topbar.newAnalysis": "Phân tích mới",
  "topbar.unsavedFile": "Tệp .gta chưa lưu",
  "topbar.complete": "Hoàn tất",
  "topbar.incomplete": "Còn {{count}} ô",
  "topbar.issues": "{{count}} vấn đề",
  "topbar.tooltipNew": "Bắt đầu phân tích mới",
  "topbar.tooltipOpen": "Mở tệp phân tích .gta đã lưu",
  "topbar.tooltipSave": "Lưu phân tích hiện tại",
  "topbar.edited": "— Đã chỉnh sửa",
  "topbar.agentsAndMcp": "Agent & MCP",
  "topbar.setupAgentsMcp": "Thiết lập Agent & MCP",
  "topbar.connected": "đã kết nối",
  "topbar.agentStatus": "{{agents}} agent{{agentSuffix}} · {{mcp}} MCP",

  // ── Right Panel ──
  "rightPanel.design": "Chi tiết",
  "rightPanel.code": "Mã",
  "rightPanel.noSelection": "Chọn một mục",

  // ── Pages ──
  "pages.title": "Trang",
  "pages.addPage": "Thêm trang",
  "pages.moveUp": "Di chuyển lên",
  "pages.moveDown": "Di chuyển xuống",

  // ── Status Bar ──
  "statusbar.zoomOut": "Thu nhỏ",
  "statusbar.zoomIn": "Phóng to",
  "statusbar.resetZoom": "Đặt lại thu phóng",

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
  "layers.title": "Đề cương",
  "layers.empty": "Chưa có mục nào. Sử dụng thanh công cụ để bắt đầu xây dựng.",

  // ── Layer Context Menu ──
  "layerMenu.groupSelection": "Nhóm các đối tượng đã chọn",
  "layerMenu.createComponent": "Tạo thành phần",
  "layerMenu.detachComponent": "Tách thành phần",
  "layerMenu.detachInstance": "Tách bản thể",
  "layerMenu.booleanUnion": "Hợp nhất",
  "layerMenu.booleanSubtract": "Trừ",
  "layerMenu.booleanIntersect": "Giao nhau",
  "layerMenu.toggleLock": "Bật/Tắt khoá",
  "layerMenu.toggleVisibility": "Bật/Tắt hiển thị",

  // ── Property Panel ──
  "property.createComponent": "Tạo thành phần",
  "property.detachComponent": "Tách thành phần",
  "property.goToComponent": "Đi đến thành phần",
  "property.detachInstance": "Tách bản thể",

  // ── Fill ──
  "fill.title": "Tô màu",
  "fill.solid": "Đặc",
  "fill.linear": "Tuyến tính",
  "fill.radial": "Toả tròn",
  "fill.image": "Hình ảnh",
  "fill.stops": "Điểm dừng",
  "fill.angle": "Góc",

  // ── Image ──
  "image.title": "Hình ảnh",
  "image.fit": "Chế độ vừa",
  "image.fill": "Lấp đầy",
  "image.fitMode": "Vừa khít",
  "image.crop": "Cắt",
  "image.tile": "Lát gạch",
  "image.clickToUpload": "Nhấp để tải lên",
  "image.changeImage": "Đổi hình ảnh",
  "image.adjustments": "Điều chỉnh",
  "image.exposure": "Phơi sáng",
  "image.contrast": "Tương phản",
  "image.saturation": "Độ bão hòa",
  "image.temperature": "Nhiệt độ màu",
  "image.tint": "Sắc thái",
  "image.highlights": "Vùng sáng",
  "image.shadows": "Vùng tối",
  "image.reset": "Đặt lại",

  // ── Stroke ──
  "stroke.title": "Viền",

  // ── Appearance ──
  "appearance.layer": "Lớp",
  "appearance.opacity": "Độ mờ",

  // ── Layout ──
  "layout.flexLayout": "Bố cục Flex",
  "layout.freedom": "Tự do (không bố cục)",
  "layout.vertical": "Bố cục dọc",
  "layout.horizontal": "Bố cục ngang",
  "layout.alignment": "Căn chỉnh",
  "layout.gap": "Khoảng cách",
  "layout.spaceBetween": "Cách đều hai đầu",
  "layout.spaceAround": "Cách đều xung quanh",
  "layout.dimensions": "Kích thước",
  "layout.fillWidth": "Lấp đầy chiều rộng",
  "layout.fillHeight": "Lấp đầy chiều cao",
  "layout.hugWidth": "Ôm chiều rộng",
  "layout.hugHeight": "Ôm chiều cao",
  "layout.clipContent": "Cắt nội dung",

  // ── Padding ──
  "padding.title": "Lề trong",
  "padding.paddingMode": "Chế độ lề trong",
  "padding.paddingValues": "Giá trị lề trong",
  "padding.oneValue": "Một giá trị cho tất cả các cạnh",
  "padding.horizontalVertical": "Ngang/Dọc",
  "padding.topRightBottomLeft": "Trên/Phải/Dưới/Trái",

  // ── Typography ──
  "text.typography": "Kiểu chữ",
  "text.lineHeight": "Chiều cao dòng",
  "text.letterSpacing": "Khoảng cách chữ",
  "text.horizontal": "Ngang",
  "text.vertical": "Dọc",
  "text.alignLeft": "Căn trái",
  "text.alignCenter": "Căn giữa",
  "text.alignRight": "Căn phải",
  "text.justify": "Căn đều",
  "text.top": "Trên",
  "text.middle": "Giữa",
  "text.bottom": "Dưới",
  "text.weight.thin": "Mảnh",
  "text.weight.light": "Nhẹ",
  "text.weight.regular": "Thường",
  "text.weight.medium": "Vừa",
  "text.weight.semibold": "Hơi đậm",
  "text.weight.bold": "Đậm",
  "text.weight.black": "Rất đậm",
  "text.font.search": "Tìm phông chữ\u2026",
  "text.font.bundled": "Đi kèm",
  "text.font.system": "Hệ thống",
  "text.font.loading": "Đang tải phông chữ\u2026",
  "text.font.noResults": "Không tìm thấy phông chữ",

  // ── Text Layout ──
  "textLayout.title": "Bố cục",
  "textLayout.dimensions": "Kích thước",
  "textLayout.resizing": "Thay đổi kích thước",
  "textLayout.autoWidth": "Tự động R",
  "textLayout.autoWidthDesc":
    "Tự động chiều rộng \u2014 văn bản mở rộng theo chiều ngang",
  "textLayout.autoHeight": "Tự động C",
  "textLayout.autoHeightDesc":
    "Tự động chiều cao \u2014 chiều rộng cố định, chiều cao tự điều chỉnh",
  "textLayout.fixed": "Cố định",
  "textLayout.fixedDesc":
    "Kích thước cố định \u2014 cả chiều rộng và chiều cao đều cố định",
  "textLayout.fillWidth": "Lấp đầy chiều rộng",
  "textLayout.fillHeight": "Lấp đầy chiều cao",

  // ── Effects ──
  "effects.title": "Hiệu ứng",
  "effects.dropShadow": "Đổ bóng",
  "effects.blur": "Làm mờ",
  "effects.spread": "Lan toả",
  "effects.color": "Màu",

  // ── Export ──
  "export.title": "Xuất",
  "export.format": "Định dạng",
  "export.scale": "Tỉ lệ",
  "export.selectedOnly": "Chỉ xuất phần đã chọn",
  "export.exportFormat": "Xuất {{format}}",
  "export.exportLayer": "Xuất lớp",

  // ── Polygon ──
  "polygon.sides": "Cạnh",

  // ── Ellipse ──
  "ellipse.start": "Bắt đầu",
  "ellipse.sweep": "Quét",
  "ellipse.innerRadius": "Bán kính trong",

  // ── Corner Radius ──
  "cornerRadius.title": "Bán kính góc",

  // ── Size / Position ──
  "size.position": "Vị trí",

  // ── Icon ──
  "icon.title": "Biểu tượng",
  "icon.searchIcons": "Tìm biểu tượng...",
  "icon.noIconsFound": "Không tìm thấy biểu tượng",
  "icon.typeToSearch": "Nhập để tìm biểu tượng Iconify",
  "icon.iconsCount": "{{count}} biểu tượng",

  // ── Variables Panel ──
  "variables.addTheme": "Thêm giao diện",
  "variables.addVariant": "Thêm biến thể",
  "variables.addVariable": "Thêm biến",
  "variables.searchVariables": "Tìm biến...",
  "variables.noMatch": "Không có biến nào khớp với tìm kiếm",
  "variables.noDefined": "Chưa có biến nào được định nghĩa",
  "variables.closeShortcut": "Đóng (\u2318\u21e7V)",
  "variables.presets": "Mẫu cài sẵn",
  "variables.savePreset": "Lưu hiện tại làm mẫu…",
  "variables.loadPreset": "Tải mẫu cài sẵn",
  "variables.importPreset": "Nhập từ tệp…",
  "variables.exportPreset": "Xuất ra tệp…",
  "variables.presetName": "Tên mẫu",
  "variables.noPresets": "Chưa có mẫu nào được lưu",

  // ── AI Chat ──
  "ai.newChat": "Cuộc trò chuyện mới",
  "ai.collapse": "Thu gọn",
  "ai.tryExample": "Thử một lệnh không gian làm việc...",
  "ai.tipSelectElements":
    "Mẹo: Chọn các mục trong không gian làm việc trước khi trò chuyện để cung cấp ngữ cảnh.",
  "ai.generating": "Đang tạo...",
  "ai.designWithAgent": "Hỏi agent về không gian làm việc này...",
  "ai.attachImage": "Đính kèm hình ảnh",
  "ai.stopGenerating": "Dừng tạo",
  "ai.sendMessage": "Gửi tin nhắn",
  "ai.loadingModels": "Đang tải mô hình...",
  "ai.noModelsConnected": "Chưa kết nối mô hình nào",
  "ai.quickAction.loginScreen": "Tóm tắt không gian làm việc này",
  "ai.quickAction.loginScreenPrompt":
    "Tóm tắt không gian làm việc hiện tại và các mục chính hiển thị trong ngữ cảnh tài liệu.",
  "ai.quickAction.foodApp": "Mô tả phần đã chọn",
  "ai.quickAction.foodAppPrompt":
    "Mô tả các mục đang được chọn và bất kỳ cấu trúc quan trọng nào bạn nhận thấy.",
  "ai.quickAction.bottomNav": "Đề xuất bước tiếp theo",
  "ai.quickAction.bottomNavPrompt":
    "Dựa trên không gian làm việc hiện tại, đề xuất ba bước tiếp theo cụ thể.",
  "ai.quickAction.colorPalette": "Giải thích các agent có sẵn",
  "ai.quickAction.colorPalettePrompt":
    "Giải thích những agent và công cụ MCP đã kết nối nào hiện có sẵn và chúng có thể hỗ trợ gì trong không gian làm việc này.",

  // ── Code Panel ──
  "code.reactTailwind": "React + Tailwind",
  "code.htmlCss": "HTML + CSS",
  "code.cssVariables": "CSS Variables",
  "code.copyClipboard": "Sao chép vào bộ nhớ tạm",
  "code.copied": "Đã sao chép!",
  "code.download": "Tải xuống tệp mã",
  "code.closeCodePanel": "Đóng bảng mã",
  "code.genCssVars": "Đang tạo CSS variables cho toàn bộ tài liệu",
  "code.genSelected": "Đang tạo mã cho {{count}} phần tử đã chọn",
  "code.genDocument": "Đang tạo mã cho toàn bộ tài liệu",
  "code.aiEnhance": "Cải thiện bằng AI",
  "code.cancelEnhance": "Hủy cải thiện",
  "code.resetEnhance": "Khôi phục gốc",
  "code.enhancing": "AI đang cải thiện mã...",
  "code.enhanced": "Đã cải thiện bởi AI",

  // ── Save Dialog ──
  "save.saveAs": "Lưu thành",
  "save.fileName": "Tên tệp",

  // ── Agent Settings ──
  "agents.title": "Thiết lập Agent & MCP",
  "agents.agentsOnCanvas": "Agent trên Canvas",
  "agents.mcpIntegrations": "Tích hợp MCP trong Terminal",
  "agents.transport": "Giao thức",
  "agents.port": "Cổng",
  "agents.mcpRestart":
    "Các tích hợp MCP sẽ có hiệu lực sau khi khởi động lại terminal.",
  "agents.modelCount": "{{count}} mô hình",
  "agents.connectionFailed": "Kết nối thất bại",
  "agents.serverError": "Lỗi máy chủ {{status}}",
  "agents.failedTo": "Không thể {{action}}",
  "agents.failedToMcp": "Không thể {{action}} máy chủ MCP",
  "agents.failedTransport": "Không thể cập nhật giao thức",
  "agents.failedMcpTransport": "Không thể cập nhật giao thức MCP",
  "agents.claudeCode": "Claude Code",
  "agents.claudeModels": "Các mô hình Claude",
  "agents.codexCli": "Codex CLI",
  "agents.openaiModels": "Các mô hình OpenAI",
  "agents.mcpServer": "Máy chủ MCP",
  "agents.mcpServerStart": "Khởi động",
  "agents.mcpServerStop": "Dừng",
  "agents.mcpServerRunning": "Đang chạy",
  "agents.mcpServerStopped": "Đã dừng",
  "agents.mcpLanAccess": "Truy cập LAN",
  "agents.mcpClientConfig": "Cấu hình client",
  "agents.stdio": "stdio",
  "agents.http": "http",
  "agents.stdioHttp": "stdio + http",
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
  "figma.title": "Nhập từ Figma",
  "figma.dropFile": "Kéo thả tệp .fig vào đây",
  "figma.orBrowse": "hoặc nhấn để duyệt",
  "figma.exportTip": "Xuất từ Figma: File \u2192 Save local copy (.fig)",
  "figma.selectFigFile": "Vui lòng chọn tệp .fig",
  "figma.noPages": "Không tìm thấy trang nào trong tệp .fig",
  "figma.parseFailed": "Không thể phân tích tệp .fig",
  "figma.convertFailed": "Không thể chuyển đổi tệp Figma",
  "figma.parsing": "Đang phân tích tệp .fig...",
  "figma.converting": "Đang chuyển đổi các nút...",
  "figma.selectPage": "Tệp này có {{count}} trang. Chọn trang để nhập:",
  "figma.layers": "{{count}} lớp",
  "figma.importAll": "Nhập tất cả các trang",
  "figma.importComplete": "Nhập hoàn tất!",
  "figma.moreWarnings": "...và {{count}} cảnh báo khác",
  "figma.tryAgain": "Thử lại",
  "figma.layoutMode": "Chế độ bố cục:",
  "figma.preserveLayout": "Giữ nguyên bố cục Figma",
  "figma.autoLayout": "Bố cục tự động OpenPencil",
  "figma.comingSoon": "Sắp ra mắt",

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "Không tìm thấy trang",

  // ── Component Browser ──
  "componentBrowser.title": "Trình duyệt UIKit",
  "componentBrowser.exportKit": "Xuất bộ kit",
  "componentBrowser.importKit": "Nhập bộ kit",
  "componentBrowser.kit": "Bộ kit:",
  "componentBrowser.all": "Tất cả",
  "componentBrowser.imported": "(đã nhập)",
  "componentBrowser.components": "thành phần",
  "componentBrowser.searchComponents": "Tìm thành phần...",
  "componentBrowser.deleteKit": "Xoá {{name}}",
  "componentBrowser.category.all": "Tất cả",
  "componentBrowser.category.buttons": "Nút",
  "componentBrowser.category.inputs": "Ô nhập",
  "componentBrowser.category.cards": "Thẻ",
  "componentBrowser.category.nav": "Điều hướng",
  "componentBrowser.category.layout": "Bố cục",
  "componentBrowser.category.feedback": "Phản hồi",
  "componentBrowser.category.data": "Dữ liệu",
  "componentBrowser.category.other": "Khác",

  // ── Variable Picker ──
  "variablePicker.boundTo": "Gắn với --{{name}}",
  "variablePicker.bindToVariable": "Gắn với biến",
  "variablePicker.unbind": "Huỷ gắn biến",
  "variablePicker.noVariables": "Chưa có biến {{type}} nào được định nghĩa",

  // ── Analysis ──
  "analysis.title": "Nhà phân tích Lý thuyết trò chơi",
  "analysis.emptyState":
    "Tôi là nhà phân tích lý thuyết trò chơi của bạn. Bạn muốn phân tích sự kiện nào?",
  "analysis.emptyHint":
    "Tôi sẽ tự động xác định người chơi, chiến lược và cấu trúc trò chơi.",
  "analysis.inputPlaceholder": "Mô tả một sự kiện cần phân tích...",
  "analysis.startingAnalysis":
    'Đang bắt đầu phân tích lý thuyết trò chơi cho "{{topic}}"...',
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
  "analysis.activity.usingWebSearchQuery": "Đang sử dụng WebSearch: {{query}}",
  "analysis.activity.agentProgress": "Tiến trình agent",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "Giai đoạn {{number}} thất bại",
  "analysis.progress.phaseLabel": "Giai đoạn {{number}}: {{name}}",
  "analysis.progress.phasesComplete":
    "{{completed}}/{{total}} giai đoạn hoàn tất",
  "analysis.progress.entityCount": "{{count}} thực thể",
  "analysis.progress.entityCountPlural": "{{count}} thực thể",

  // ── Analysis Failures ──
  "analysis.failure.timeout": "hết thời gian",
  "analysis.failure.parseError": "lỗi phân tích cú pháp",
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
  "analysis.entities.noMatching": "Không có thực thể phù hợp",
  "analysis.entities.searchHint": "Thử từ khóa khác hoặc xóa bộ lọc loại.",
  "analysis.entities.confidence.high": "Cao",
  "analysis.entities.confidence.medium": "Trung bình",
  "analysis.entities.confidence.low": "Thấp",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "Con người",
  "analysis.entities.source.computed": "Tính toán",
} as const;

export default vi;
