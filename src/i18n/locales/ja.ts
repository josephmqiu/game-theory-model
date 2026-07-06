import type { TranslationKeys } from "./en";

const ja: TranslationKeys = {
  // ── Common ──
  "common.connect": "接続",
  "common.disconnect": "切断",
  "common.best": "最適",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "新規",
  "topbar.open": "開く",
  "topbar.save": "保存",
  "topbar.fullscreen": "フルスクリーン",
  "topbar.exitFullscreen": "フルスクリーンを終了",
  "topbar.newAnalysis": "新規分析",
  "topbar.unsavedFile": "未保存の .gta ファイル",
  "topbar.tooltipNew": "新しい分析を開始",
  "topbar.tooltipOpen": "保存済みの .gta 分析を開く",
  "topbar.tooltipSave": "現在の分析を保存",
  "topbar.edited": "— 編集済み",
  "topbar.agentsAndMcp": "Agents & MCP",
  "topbar.setupAgentsMcp": "Agents & MCP を設定",
  "topbar.connected": "接続済み",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "ソフトウェアアップデート",
  "updater.dismiss": "閉じる",
  "updater.current": "現在のバージョン",
  "updater.latest": "最新バージョン",
  "updater.unknown": "不明",
  "updater.checking": "確認中...",
  "updater.downloadProgress": "ダウンロード進捗",
  "updater.checkAgain": "再確認",
  "updater.restartInstall": "再起動してインストール",
  "updater.installing": "インストール中...",
  "updater.releaseDate": "リリース日：{{date}}",
  "updater.restartHint":
    "再起動してアップデートを適用します。再起動には通常 10〜15 秒かかります。",
  "updater.unknownError": "不明なアップデートエラーです。",
  "updater.title.checking": "アップデートを確認中",
  "updater.title.available": "アップデートが見つかりました",
  "updater.title.downloading": "アップデートをダウンロード中",
  "updater.title.downloaded": "インストール準備完了",
  "updater.title.error": "アップデートに失敗しました",
  "updater.subtitle.checking": "最新リリースを確認中...",
  "updater.subtitle.available": "バージョン {{version}} が利用可能です。",
  "updater.subtitle.availableGeneric": "新しいバージョンが利用可能です。",
  "updater.subtitle.downloading":
    "バージョン {{version}} をバックグラウンドでダウンロード中。",
  "updater.subtitle.downloadingGeneric":
    "アップデートパッケージをバックグラウンドでダウンロード中。",
  "updater.subtitle.downloaded":
    "バージョン {{version}} のダウンロードが完了しました。",
  "updater.subtitle.downloadedGeneric":
    "アップデートのダウンロードが完了しました。",
  "updater.subtitle.error":
    "アップデートの確認またはダウンロードができませんでした。",

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
  "ai.newChat": "新しいチャット",
  "ai.collapse": "折りたたむ",
  "ai.generating": "生成中...",
  "ai.stopGenerating": "生成を停止",
  "ai.sendMessage": "メッセージを送信",
  "ai.loadingModels": "モデルを読み込み中...",
  "ai.noModelsConnected": "モデルが接続されていません",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "Agents & MCP を設定",
  "agents.agentsOnCanvas": "キャンバス上の Agents",
  "agents.mcpIntegrations": "ターミナルでの MCP 連携",
  "agents.port": "ポート",
  "agents.mcpRestart": "MCP 連携はターミナルの再起動後に有効になります。",
  "agents.modelCount": "{{count}} 個のモデル",
  "agents.connectionFailed": "接続に失敗しました",
  "agents.serverError": "サーバーエラー {{status}}",
  "agents.failedTo": "{{action}}に失敗しました",
  "agents.failedToMcp": "MCP サーバーの{{action}}に失敗しました",
  "agents.claudeModels": "Claude モデル",
  "agents.openaiModels": "OpenAI モデル",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75 以上の LLM プロバイダー",
  "agents.mcpServer": "MCP サーバー",
  "agents.mcpServerStop": "停止",
  "agents.mcpServerRunning": "実行中",
  "agents.mcpServerStopped": "停止中",
  "agents.mcpClientConfig": "クライアント設定",
  "agents.autoUpdate": "自動アップデート確認",
  "agents.notInstalled": "未インストール",
  "agents.install": "インストール",
  "agents.installing": "インストール中...",
  "agents.installFailed": "インストール失敗",
  "agents.viewDocs": "ドキュメント",
  "agents.analysisRuntime": "分析ランタイム",
  "agents.analysisWebSearch": "ウェブ検索",
  "agents.analysisWebSearchHint":
    "分析実行中にライブウェブリサーチを使用します。",
  "agents.analysisEffort": "分析の深さ",
  "agents.analysisEffortHint":
    "分析実行の深さのガイダンスを制御します。モデル選択には影響しません。",
  "agents.analysisEffortQuick": "クイック",
  "agents.analysisEffortStandard": "スタンダード",
  "agents.analysisEffortThorough": "詳細",
  "agents.analysisPhases": "フェーズ選択",
  "agents.analysisPhasesHint":
    "カスタムフェーズは選択されたフェーズのみ実行し、自動下流再検証が無効になる場合があります。",
  "agents.analysisPhasesAll": "すべてのフェーズ",
  "agents.analysisPhasesCustom": "カスタム",
  "agents.customProvider": "カスタム API",
  "agents.customProviderDesc": "OpenAI 互換の任意のエンドポイント — OpenCode Go/Zen、OpenRouter、DeepSeek、または独自の URL",
  "agents.customPreset": "プロバイダープリセット",
  "agents.customBaseUrl": "ベース URL",
  "agents.customApiKey": "API キー",
  "agents.customModelIds": "モデル ID（カンマ区切り、任意）",
  "agents.customNativeSearch": "モデルに Web 検索が組み込まれている",
  "agents.customNativeSearchHint": "オンの場合、アプリの Web 検索ツールはこのエンドポイントに提供されません",
  "agents.customModels": "カスタムモデル",
  "agents.searchProvider": "検索プロバイダー",
  "agents.searchApiKey": "検索 API キー",
  "agents.searchKeyHint": "ライブ Web リサーチには検索プロバイダーのキーが必要です（Tavily または Brave）",
  "agents.customKeyStoredPlain": "このブラウザーはキーを暗号化せずに保存します。暗号化ストレージにはデスクトップアプリを使用してください。",
  "agents.customKeyNotEncrypted": "OS の暗号化が利用できないため、キーは保存されませんでした。システムのキーチェーンを有効にして再試行してください。",
  "agents.customConnect": "接続",
  "agents.searchProviderNone": "なし",
  "agents.customClearKey": "API キーをクリア",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "ページが見つかりません",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "ゲーム理論アナリスト",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "分析の実行中はモデルを変更できません。先に分析を停止してください。",
  "analysis.unsavedChanges":
    "未保存の分析変更があります。破棄して新しい分析を開始しますか？",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "フェーズ分析を準備中。",
  "analysis.activity.researching": "エビデンスを調査中。",
  "analysis.activity.synthesizing": "フェーズ出力を統合中。",
  "analysis.activity.validating": "構造化出力を検証中。",
  "analysis.activity.retrying":
    "検証またはトランスポートの問題後にフェーズを再試行中。",
  "analysis.activity.default": "フェーズ分析を継続中。",
  "analysis.activity.usingTool": "{{toolName}} を使用中",
  "analysis.activity.usingWebSearchQuery":
    "WebSearch を使用中: {{query}}",
  "analysis.activity.agentProgress": "エージェントの進捗",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "フェーズ {{number}} が失敗しました",
  "analysis.progress.phaseLabel": "フェーズ {{number}}：{{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} フェーズ完了",
  "analysis.progress.entityCount": "{{count}} エンティティ",
  "analysis.progress.entityCountPlural": "{{count}} エンティティ",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "タイムアウト",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "プロバイダーエラー",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "状況の基盤構築",
  "analysis.phases.playerIdentification": "プレイヤーの特定",
  "analysis.phases.baselineModel": "ベースラインモデル",
  "analysis.phases.historicalGame": "歴史的ゲーム",
  "analysis.phases.revalidation": "再検証",
  "analysis.phases.formalModeling": "形式的モデリング",
  "analysis.phases.assumptions": "仮定",
  "analysis.phases.elimination": "消去",
  "analysis.phases.scenarios": "シナリオ",
  "analysis.phases.metaCheck": "メタチェック",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "フェーズを再実行",
  "analysis.sidebar.searchEntities": "エンティティを検索...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "事実",
  "analysis.entities.player": "プレイヤー",
  "analysis.entities.objective": "目的",
  "analysis.entities.game": "ゲーム",
  "analysis.entities.strategy": "戦略",
  "analysis.entities.payoff": "利得",
  "analysis.entities.rule": "ルール",
  "analysis.entities.escalation": "エスカレーション",
  "analysis.entities.history": "歴史",
  "analysis.entities.pattern": "パターン",
  "analysis.entities.trust": "信頼",
  "analysis.entities.commitment": "コミットメント",
  "analysis.entities.signal": "シグナル",
  "analysis.entities.matrix": "行列",
  "analysis.entities.gameTree": "ゲーム木",
  "analysis.entities.equilibrium": "均衡",
  "analysis.entities.constraints": "制約",
  "analysis.entities.crossGame": "クロスゲーム",
  "analysis.entities.signalClass": "シグナルクラス",
  "analysis.entities.bargaining": "交渉",
  "analysis.entities.optionValue": "オプション価値",
  "analysis.entities.behavioral": "行動",
  "analysis.entities.assumption": "仮定",
  "analysis.entities.eliminated": "消去済み",
  "analysis.entities.scenario": "シナリオ",
  "analysis.entities.thesis": "テーゼ",
  "analysis.entities.metaCheck": "メタチェック",
  "analysis.entities.confidence.high": "高",
  "analysis.entities.confidence.medium": "中",
  "analysis.entities.confidence.low": "低",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "人間",
} as const;

export default ja;
