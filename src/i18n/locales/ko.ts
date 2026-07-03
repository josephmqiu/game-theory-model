import type { TranslationKeys } from "./en";

const ko: TranslationKeys = {
  // ── Common ──
  "common.connect": "연결",
  "common.disconnect": "연결 해제",
  "common.best": "추천",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "새로 만들기",
  "topbar.open": "열기",
  "topbar.save": "저장",
  "topbar.fullscreen": "전체 화면",
  "topbar.exitFullscreen": "전체 화면 종료",
  "topbar.newAnalysis": "새 분석",
  "topbar.unsavedFile": "저장되지 않은 .gta 파일",
  "topbar.tooltipNew": "새 분석 시작",
  "topbar.tooltipOpen": "저장된 .gta 분석 열기",
  "topbar.tooltipSave": "현재 분석 저장",
  "topbar.edited": "— 수정됨",
  "topbar.agentsAndMcp": "에이전트 & MCP",
  "topbar.setupAgentsMcp": "에이전트 & MCP 설정",
  "topbar.connected": "연결됨",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

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
  "ai.newChat": "새 대화",
  "ai.collapse": "접기",
  "ai.generating": "생성 중...",
  "ai.stopGenerating": "생성 중지",
  "ai.sendMessage": "메시지 보내기",
  "ai.loadingModels": "모델 로딩 중...",
  "ai.noModelsConnected": "연결된 모델 없음",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "에이전트 & MCP 설정",
  "agents.agentsOnCanvas": "캔버스 에이전트",
  "agents.mcpIntegrations": "터미널 MCP 연동",
  "agents.port": "포트",
  "agents.mcpRestart": "MCP 연동은 터미널을 재시작한 후 적용됩니다.",
  "agents.modelCount": "모델 {{count}}개",
  "agents.connectionFailed": "연결 실패",
  "agents.serverError": "서버 오류 {{status}}",
  "agents.failedTo": "{{action}} 실패",
  "agents.failedToMcp": "MCP 서버 {{action}} 실패",
  "agents.claudeModels": "Claude 모델",
  "agents.openaiModels": "OpenAI 모델",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75개 이상의 LLM 제공자",
  "agents.mcpServer": "MCP 서버",
  "agents.mcpServerStop": "정지",
  "agents.mcpServerRunning": "실행 중",
  "agents.mcpServerStopped": "정지됨",
  "agents.mcpClientConfig": "클라이언트 설정",
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

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "페이지를 찾을 수 없습니다",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "게임이론 분석가",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
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
  "analysis.activity.usingWebSearchQuery":
    "WebSearch 사용 중: {{query}}",
  "analysis.activity.agentProgress": "에이전트 진행 상황",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "단계 {{number}} 실패",
  "analysis.progress.phaseLabel": "단계 {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} 단계 완료",
  "analysis.progress.entityCount": "엔티티 {{count}}개",
  "analysis.progress.entityCountPlural": "엔티티 {{count}}개",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "시간 초과",
  "analysis.failure.unknown": "unknown error",
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
  "analysis.entities.confidence.high": "높음",
  "analysis.entities.confidence.medium": "보통",
  "analysis.entities.confidence.low": "낮음",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "수동",
} as const;

export default ko;
