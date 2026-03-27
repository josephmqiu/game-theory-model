import type { TranslationKeys } from "./en";

const ko: TranslationKeys = {
  // ── Common ──
  "common.rename": "이름 변경",
  "common.duplicate": "복제",
  "common.delete": "삭제",
  "common.cancel": "취소",
  "common.save": "저장",
  "common.close": "닫기",
  "common.connect": "연결",
  "common.disconnect": "연결 해제",
  "common.import": "가져오기",
  "common.export": "내보내기",
  "common.name": "이름",
  "common.untitled": "제목 없음",
  "common.best": "추천",
  "common.selected": "{{count}}개 선택됨",

  // ── Toolbar ──
  "toolbar.select": "선택",
  "toolbar.text": "텍스트",
  "toolbar.frame": "프레임",
  "toolbar.hand": "손",
  "toolbar.undo": "실행 취소",
  "toolbar.redo": "다시 실행",
  "toolbar.variables": "변수",
  "toolbar.uikitBrowser": "UIKit 브라우저",

  // ── Shapes ──
  "shapes.rectangle": "사각형",
  "shapes.ellipse": "타원",
  "shapes.polygon": "다각형",
  "shapes.line": "선",
  "shapes.icon": "아이콘",
  "shapes.importImageSvg": "이미지 또는 SVG 가져오기\u2026",
  "shapes.pen": "펜",
  "shapes.shapeTools": "도형 도구",
  "shapes.moreShapeTools": "더 많은 도형 도구",

  // ── Top Bar ──
  "topbar.hideLayers": "개요 숨기기",
  "topbar.showLayers": "개요 표시",
  "topbar.new": "새로 만들기",
  "topbar.open": "열기",
  "topbar.save": "저장",
  "topbar.importFigma": "Figma 가져오기",
  "topbar.codePanel": "코드",
  "topbar.fullscreen": "전체 화면",
  "topbar.exitFullscreen": "전체 화면 종료",
  "topbar.newAnalysis": "새 분석",
  "topbar.unsavedFile": "저장되지 않은 .gta 파일",
  "topbar.complete": "완료",
  "topbar.incomplete": "{{count}}개 셀 남음",
  "topbar.issues": "{{count}}개 문제",
  "topbar.tooltipNew": "새 분석 시작",
  "topbar.tooltipOpen": "저장된 .gta 분석 열기",
  "topbar.tooltipSave": "현재 분석 저장",
  "topbar.edited": "— 수정됨",
  "topbar.agentsAndMcp": "에이전트 & MCP",
  "topbar.setupAgentsMcp": "에이전트 & MCP 설정",
  "topbar.connected": "연결됨",
  "topbar.agentStatus": "에이전트 {{agents}}개{{agentSuffix}} · MCP {{mcp}}개",

  // ── Right Panel ──
  "rightPanel.design": "세부 정보",
  "rightPanel.code": "코드",
  "rightPanel.noSelection": "항목을 선택하세요",

  // ── Pages ──
  "pages.title": "페이지",
  "pages.addPage": "페이지 추가",
  "pages.moveUp": "위로 이동",
  "pages.moveDown": "아래로 이동",

  // ── Status Bar ──
  "statusbar.zoomOut": "축소",
  "statusbar.zoomIn": "확대",
  "statusbar.resetZoom": "확대/축소 초기화",

  // ── Updater ──
  "updater.softwareUpdate": "소프트웨어 업데이트",
  "updater.dismiss": "닫기",
  "updater.current": "현재 버전",
  "updater.latest": "최신 버전",
  "updater.unknown": "알 수 없음",
  "updater.checking": "확인 중...",
  "updater.downloadProgress": "다운로드 진행률",
  "updater.checkAgain": "다시 확인",
  "updater.restartInstall": "재시작 및 설치",
  "updater.installing": "설치 중...",
  "updater.releaseDate": "출시일: {{date}}",
  "updater.restartHint":
    "업데이트를 적용하려면 재시작하세요. 재실행은 보통 10~15초 소요됩니다.",
  "updater.unknownError": "알 수 없는 업데이트 오류입니다.",
  "updater.title.checking": "업데이트 확인 중",
  "updater.title.available": "업데이트 발견",
  "updater.title.downloading": "업데이트 다운로드 중",
  "updater.title.downloaded": "설치 준비 완료",
  "updater.title.error": "업데이트 실패",
  "updater.subtitle.checking": "최신 릴리스를 확인하고 있습니다...",
  "updater.subtitle.available": "버전 {{version}}을 사용할 수 있습니다.",
  "updater.subtitle.availableGeneric": "새 버전을 사용할 수 있습니다.",
  "updater.subtitle.downloading":
    "버전 {{version}}을 백그라운드에서 다운로드 중입니다.",
  "updater.subtitle.downloadingGeneric":
    "업데이트 패키지를 백그라운드에서 다운로드 중입니다.",
  "updater.subtitle.downloaded": "버전 {{version}}이 다운로드되었습니다.",
  "updater.subtitle.downloadedGeneric": "업데이트가 다운로드되었습니다.",
  "updater.subtitle.error": "업데이트를 확인하거나 다운로드할 수 없습니다.",

  // ── Layers ──
  "layers.title": "개요",
  "layers.empty":
    "아직 항목이 없습니다. 도구 모음을 사용하여 구성을 시작하세요.",

  // ── Layer Context Menu ──
  "layerMenu.groupSelection": "선택 항목 그룹화",
  "layerMenu.createComponent": "컴포넌트 만들기",
  "layerMenu.detachComponent": "컴포넌트 분리",
  "layerMenu.detachInstance": "인스턴스 분리",
  "layerMenu.booleanUnion": "합치기",
  "layerMenu.booleanSubtract": "빼기",
  "layerMenu.booleanIntersect": "교차",
  "layerMenu.toggleLock": "잠금 전환",
  "layerMenu.toggleVisibility": "표시 전환",

  // ── Property Panel ──
  "property.createComponent": "컴포넌트 만들기",
  "property.detachComponent": "컴포넌트 분리",
  "property.goToComponent": "컴포넌트로 이동",
  "property.detachInstance": "인스턴스 분리",

  // ── Fill ──
  "fill.title": "채우기",
  "fill.solid": "단색",
  "fill.linear": "선형",
  "fill.radial": "방사형",
  "fill.image": "이미지",
  "fill.stops": "정지점",
  "fill.angle": "각도",

  // ── Image ──
  "image.title": "이미지",
  "image.fit": "맞춤 모드",
  "image.fill": "채우기",
  "image.fitMode": "맞춤",
  "image.crop": "자르기",
  "image.tile": "타일",
  "image.clickToUpload": "클릭하여 업로드",
  "image.changeImage": "이미지 변경",
  "image.adjustments": "조정",
  "image.exposure": "노출",
  "image.contrast": "대비",
  "image.saturation": "채도",
  "image.temperature": "색온도",
  "image.tint": "틴트",
  "image.highlights": "하이라이트",
  "image.shadows": "그림자",
  "image.reset": "초기화",

  // ── Stroke ──
  "stroke.title": "선",

  // ── Appearance ──
  "appearance.layer": "레이어",
  "appearance.opacity": "불투명도",

  // ── Layout ──
  "layout.flexLayout": "플렉스 레이아웃",
  "layout.freedom": "자유 (레이아웃 없음)",
  "layout.vertical": "세로 레이아웃",
  "layout.horizontal": "가로 레이아웃",
  "layout.alignment": "정렬",
  "layout.gap": "간격",
  "layout.spaceBetween": "균등 배치",
  "layout.spaceAround": "균등 여백",
  "layout.dimensions": "크기",
  "layout.fillWidth": "너비 채우기",
  "layout.fillHeight": "높이 채우기",
  "layout.hugWidth": "너비 맞춤",
  "layout.hugHeight": "높이 맞춤",
  "layout.clipContent": "콘텐츠 잘라내기",

  // ── Padding ──
  "padding.title": "패딩",
  "padding.paddingMode": "패딩 모드",
  "padding.paddingValues": "패딩 값",
  "padding.oneValue": "모든 면에 동일한 값",
  "padding.horizontalVertical": "가로/세로",
  "padding.topRightBottomLeft": "위/오른쪽/아래/왼쪽",

  // ── Typography ──
  "text.typography": "타이포그래피",
  "text.lineHeight": "줄 높이",
  "text.letterSpacing": "자간",
  "text.horizontal": "가로",
  "text.vertical": "세로",
  "text.alignLeft": "왼쪽 정렬",
  "text.alignCenter": "가운데 정렬",
  "text.alignRight": "오른쪽 정렬",
  "text.justify": "양쪽 정렬",
  "text.top": "위",
  "text.middle": "중간",
  "text.bottom": "아래",
  "text.weight.thin": "Thin",
  "text.weight.light": "Light",
  "text.weight.regular": "Regular",
  "text.weight.medium": "Medium",
  "text.weight.semibold": "Semibold",
  "text.weight.bold": "Bold",
  "text.weight.black": "Black",
  "text.font.search": "글꼴 검색\u2026",
  "text.font.bundled": "번들",
  "text.font.system": "시스템",
  "text.font.loading": "글꼴 로드 중\u2026",
  "text.font.noResults": "글꼴을 찾을 수 없습니다",

  // ── Text Layout ──
  "textLayout.title": "레이아웃",
  "textLayout.dimensions": "크기",
  "textLayout.resizing": "크기 조절",
  "textLayout.autoWidth": "자동 W",
  "textLayout.autoWidthDesc": "자동 너비 — 텍스트가 가로로 확장됩니다",
  "textLayout.autoHeight": "자동 H",
  "textLayout.autoHeightDesc": "자동 높이 — 고정 너비, 높이가 자동 조절됩니다",
  "textLayout.fixed": "고정",
  "textLayout.fixedDesc": "고정 크기 — 너비와 높이가 모두 고정됩니다",
  "textLayout.fillWidth": "너비 채우기",
  "textLayout.fillHeight": "높이 채우기",

  // ── Effects ──
  "effects.title": "효과",
  "effects.dropShadow": "그림자",
  "effects.blur": "블러",
  "effects.spread": "확산",
  "effects.color": "색상",

  // ── Export ──
  "export.title": "내보내기",
  "export.format": "형식",
  "export.scale": "배율",
  "export.selectedOnly": "선택 항목만 내보내기",
  "export.exportFormat": "{{format}} 내보내기",
  "export.exportLayer": "레이어 내보내기",

  // ── Polygon ──
  "polygon.sides": "변 수",

  // ── Ellipse ──
  "ellipse.start": "시작",
  "ellipse.sweep": "스윕",
  "ellipse.innerRadius": "내경",

  // ── Corner Radius ──
  "cornerRadius.title": "모서리 반경",

  // ── Size / Position ──
  "size.position": "위치",

  // ── Icon ──
  "icon.title": "아이콘",
  "icon.searchIcons": "아이콘 검색...",
  "icon.noIconsFound": "아이콘을 찾을 수 없습니다",
  "icon.typeToSearch": "Iconify 아이콘을 검색하려면 입력하세요",
  "icon.iconsCount": "아이콘 {{count}}개",

  // ── Variables Panel ──
  "variables.addTheme": "테마 추가",
  "variables.addVariant": "변형 추가",
  "variables.addVariable": "변수 추가",
  "variables.searchVariables": "변수 검색...",
  "variables.noMatch": "검색과 일치하는 변수가 없습니다",
  "variables.noDefined": "정의된 변수가 없습니다",
  "variables.closeShortcut": "닫기 (⌘⇧V)",
  "variables.presets": "프리셋",
  "variables.savePreset": "현재 설정을 프리셋으로 저장…",
  "variables.loadPreset": "프리셋 불러오기",
  "variables.importPreset": "파일에서 가져오기…",
  "variables.exportPreset": "파일로 내보내기…",
  "variables.presetName": "프리셋 이름",
  "variables.noPresets": "저장된 프리셋 없음",

  // ── AI Chat ──
  "ai.newChat": "새 대화",
  "ai.collapse": "접기",
  "ai.tryExample": "워크스페이스 프롬프트를 시도해 보세요...",
  "ai.tipSelectElements":
    "팁: 대화 전에 워크스페이스에서 항목을 선택하면 컨텍스트가 제공됩니다.",
  "ai.generating": "생성 중...",
  "ai.designWithAgent": "에이전트에게 이 워크스페이스에 대해 질문...",
  "ai.attachImage": "이미지 첨부",
  "ai.stopGenerating": "생성 중지",
  "ai.sendMessage": "메시지 보내기",
  "ai.loadingModels": "모델 로딩 중...",
  "ai.noModelsConnected": "연결된 모델 없음",
  "ai.quickAction.loginScreen": "워크스페이스 요약",
  "ai.quickAction.loginScreenPrompt":
    "현재 워크스페이스와 문서 컨텍스트에 표시된 주요 항목을 요약해 주세요.",
  "ai.quickAction.foodApp": "선택 항목 설명",
  "ai.quickAction.foodAppPrompt":
    "현재 선택된 항목과 주목할 만한 중요한 구조를 설명해 주세요.",
  "ai.quickAction.bottomNav": "다음 단계 제안",
  "ai.quickAction.bottomNavPrompt":
    "현재 워크스페이스를 기반으로 구체적인 다음 단계 세 가지를 제안해 주세요.",
  "ai.quickAction.colorPalette": "사용 가능한 에이전트 설명",
  "ai.quickAction.colorPalettePrompt":
    "현재 연결된 에이전트와 MCP 도구를 설명하고, 이 워크스페이스에서 어떻게 도움이 될 수 있는지 설명해 주세요.",

  // ── Code Panel ──
  "code.reactTailwind": "React + Tailwind",
  "code.htmlCss": "HTML + CSS",
  "code.cssVariables": "CSS Variables",
  "code.copyClipboard": "클립보드에 복사",
  "code.copied": "복사됨!",
  "code.download": "코드 파일 다운로드",
  "code.closeCodePanel": "코드 패널 닫기",
  "code.genCssVars": "전체 문서의 CSS 변수를 생성 중",
  "code.genSelected": "선택한 요소 {{count}}개의 코드를 생성 중",
  "code.genDocument": "전체 문서의 코드를 생성 중",
  "code.aiEnhance": "AI 개선",
  "code.cancelEnhance": "개선 취소",
  "code.resetEnhance": "원본으로 복원",
  "code.enhancing": "AI가 코드를 개선 중...",
  "code.enhanced": "AI로 개선됨",

  // ── Save Dialog ──
  "save.saveAs": "다른 이름으로 저장",
  "save.fileName": "파일 이름",

  // ── Agent Settings ──
  "agents.title": "에이전트 & MCP 설정",
  "agents.agentsOnCanvas": "캔버스 에이전트",
  "agents.mcpIntegrations": "터미널 MCP 연동",
  "agents.transport": "전송 방식",
  "agents.port": "포트",
  "agents.mcpRestart": "MCP 연동은 터미널을 재시작한 후 적용됩니다.",
  "agents.modelCount": "모델 {{count}}개",
  "agents.connectionFailed": "연결 실패",
  "agents.serverError": "서버 오류 {{status}}",
  "agents.failedTo": "{{action}} 실패",
  "agents.failedToMcp": "MCP 서버 {{action}} 실패",
  "agents.failedTransport": "전송 방식 업데이트 실패",
  "agents.failedMcpTransport": "MCP 전송 방식 업데이트 실패",
  "agents.claudeCode": "Claude Code",
  "agents.claudeModels": "Claude 모델",
  "agents.codexCli": "Codex CLI",
  "agents.codexModels": "Codex 모델",
  "agents.mcpServer": "MCP 서버",
  "agents.mcpServerStart": "시작",
  "agents.mcpServerStop": "정지",
  "agents.mcpServerRunning": "실행 중",
  "agents.mcpServerStopped": "정지됨",
  "agents.mcpLanAccess": "LAN 접근",
  "agents.mcpClientConfig": "클라이언트 설정",
  "agents.stdio": "stdio",
  "agents.http": "http",
  "agents.stdioHttp": "stdio + http",
  "agents.autoUpdate": "자동 업데이트 확인",
  "agents.notInstalled": "설치되지 않음",
  "agents.install": "설치",
  "agents.installing": "설치 중...",
  "agents.installFailed": "설치 실패",
  "agents.viewDocs": "문서",
  "agents.analysisRuntime": "분석 런타임",
  "agents.analysisWebSearch": "웹 검색",
  "agents.analysisWebSearchHint": "분석 실행 중 실시간 웹 조사를 사용합니다.",
  "agents.analysisEffort": "분석 강도",
  "agents.analysisEffortHint":
    "분석 실행의 깊이 지침을 제어합니다. 모델 선택에는 영향을 미치지 않습니다.",
  "agents.analysisEffortQuick": "빠르게",
  "agents.analysisEffortStandard": "표준",
  "agents.analysisEffortThorough": "철저하게",
  "agents.analysisPhases": "단계 선택",
  "agents.analysisPhasesHint":
    "사용자 정의 단계는 선택된 단계만 실행하며, 자동 하위 재검증이 비활성화될 수 있습니다.",
  "agents.analysisPhasesAll": "모든 단계",
  "agents.analysisPhasesCustom": "사용자 정의",

  // ── Figma Import ──
  "figma.title": "Figma에서 가져오기",
  "figma.dropFile": ".fig 파일을 여기에 놓으세요",
  "figma.orBrowse": "또는 클릭하여 찾아보기",
  "figma.exportTip": "Figma에서 내보내기: 파일 → 로컬 사본 저장 (.fig)",
  "figma.selectFigFile": ".fig 파일을 선택해 주세요",
  "figma.noPages": ".fig 파일에서 페이지를 찾을 수 없습니다",
  "figma.parseFailed": ".fig 파일 파싱에 실패했습니다",
  "figma.convertFailed": "Figma 파일 변환에 실패했습니다",
  "figma.parsing": ".fig 파일 파싱 중...",
  "figma.converting": "노드 변환 중...",
  "figma.selectPage":
    "이 파일에는 {{count}}개의 페이지가 있습니다. 가져올 페이지를 선택하세요:",
  "figma.layers": "{{count}}개 레이어",
  "figma.importAll": "모든 페이지 가져오기",
  "figma.importComplete": "가져오기 완료!",
  "figma.moreWarnings": "...외 {{count}}개의 경고",
  "figma.tryAgain": "다시 시도",
  "figma.layoutMode": "레이아웃 모드:",
  "figma.preserveLayout": "Figma 레이아웃 유지",
  "figma.autoLayout": "자동 레이아웃",
  "figma.comingSoon": "출시 예정",

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "페이지를 찾을 수 없습니다",

  // ── Component Browser ──
  "componentBrowser.title": "UIKit 브라우저",
  "componentBrowser.exportKit": "키트 내보내기",
  "componentBrowser.importKit": "키트 가져오기",
  "componentBrowser.kit": "키트:",
  "componentBrowser.all": "전체",
  "componentBrowser.imported": "(가져옴)",
  "componentBrowser.components": "컴포넌트",
  "componentBrowser.searchComponents": "컴포넌트 검색...",
  "componentBrowser.deleteKit": "{{name}} 삭제",
  "componentBrowser.category.all": "전체",
  "componentBrowser.category.buttons": "버튼",
  "componentBrowser.category.inputs": "입력",
  "componentBrowser.category.cards": "카드",
  "componentBrowser.category.nav": "내비게이션",
  "componentBrowser.category.layout": "레이아웃",
  "componentBrowser.category.feedback": "피드백",
  "componentBrowser.category.data": "데이터",
  "componentBrowser.category.other": "기타",

  // ── Variable Picker ──
  "variablePicker.boundTo": "--{{name}}에 바인딩됨",
  "variablePicker.bindToVariable": "변수에 바인딩",
  "variablePicker.unbind": "변수 바인딩 해제",
  "variablePicker.noVariables": "{{type}} 변수가 정의되지 않았습니다",

  // ── Analysis ──
  "analysis.title": "게임이론 분석가",
  "analysis.emptyState": "게임이론 분석가입니다. 어떤 사건을 분석하시겠습니까?",
  "analysis.emptyHint": "플레이어, 전략, 게임 구조를 자동으로 식별합니다.",
  "analysis.inputPlaceholder": "분석할 사건을 설명하세요...",
  "analysis.startingAnalysis":
    '"{{topic}}"에 대한 게임이론 분석을 시작합니다...',
  "analysis.cannotChangeModel":
    "분석 실행 중에는 모델을 변경할 수 없습니다. 먼저 분석을 중지하세요.",
  "analysis.unsavedChanges":
    "저장되지 않은 분석 변경 사항이 있습니다. 변경 사항을 버리고 새 분석을 시작하시겠습니까?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "단계 분석을 준비 중입니다.",
  "analysis.activity.researching": "증거를 조사 중입니다.",
  "analysis.activity.synthesizing": "단계 출력을 종합 중입니다.",
  "analysis.activity.validating": "구조화된 출력을 검증 중입니다.",
  "analysis.activity.retrying":
    "검증 또는 전송 문제 후 단계를 재시도 중입니다.",
  "analysis.activity.default": "단계 분석을 계속 진행 중입니다.",
  "analysis.activity.usingTool": "{{toolName}} 사용 중",
  "analysis.activity.usingWebSearchQuery": "WebSearch 사용 중: {{query}}",
  "analysis.activity.agentProgress": "에이전트 진행 상황",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "단계 {{number}} 실패",
  "analysis.progress.phaseLabel": "단계 {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} 단계 완료",
  "analysis.progress.entityCount": "엔티티 {{count}}개",
  "analysis.progress.entityCountPlural": "엔티티 {{count}}개",

  // ── Analysis Failures ──
  "analysis.failure.timeout": "시간 초과",
  "analysis.failure.parseError": "파싱 오류",
  "analysis.failure.providerError": "제공자 오류",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "상황 기반 구축",
  "analysis.phases.playerIdentification": "플레이어 식별",
  "analysis.phases.baselineModel": "기준 모델",
  "analysis.phases.historicalGame": "역사적 게임",
  "analysis.phases.revalidation": "재검증",
  "analysis.phases.formalModeling": "형식적 모델링",
  "analysis.phases.assumptions": "가정",
  "analysis.phases.elimination": "소거",
  "analysis.phases.scenarios": "시나리오",
  "analysis.phases.metaCheck": "메타 점검",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "단계 재실행",
  "analysis.sidebar.searchEntities": "엔티티 검색...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "사실",
  "analysis.entities.player": "플레이어",
  "analysis.entities.objective": "목표",
  "analysis.entities.game": "게임",
  "analysis.entities.strategy": "전략",
  "analysis.entities.payoff": "보수",
  "analysis.entities.rule": "규칙",
  "analysis.entities.escalation": "확전",
  "analysis.entities.history": "역사",
  "analysis.entities.pattern": "패턴",
  "analysis.entities.trust": "신뢰",
  "analysis.entities.commitment": "공약",
  "analysis.entities.signal": "신호",
  "analysis.entities.matrix": "행렬",
  "analysis.entities.gameTree": "게임 트리",
  "analysis.entities.equilibrium": "균형",
  "analysis.entities.constraints": "제약",
  "analysis.entities.crossGame": "교차 게임",
  "analysis.entities.signalClass": "신호 유형",
  "analysis.entities.bargaining": "협상",
  "analysis.entities.optionValue": "옵션 가치",
  "analysis.entities.behavioral": "행동",
  "analysis.entities.assumption": "가정",
  "analysis.entities.eliminated": "소거됨",
  "analysis.entities.scenario": "시나리오",
  "analysis.entities.thesis": "논제",
  "analysis.entities.metaCheck": "메타 점검",
  "analysis.entities.noMatching": "일치하는 엔티티가 없습니다",
  "analysis.entities.searchHint":
    "다른 검색어를 시도하거나 유형 필터를 제거하세요.",
  "analysis.entities.confidence.high": "높음",
  "analysis.entities.confidence.medium": "보통",
  "analysis.entities.confidence.low": "낮음",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "수동",
  "analysis.entities.source.computed": "계산",
} as const;

export default ko;
