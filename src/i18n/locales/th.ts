import type { TranslationKeys } from "./en";

const th: TranslationKeys = {
  // ── Common ──
  "common.connect": "เชื่อมต่อ",
  "common.disconnect": "ตัดการเชื่อมต่อ",
  "common.best": "ดีที่สุด",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "ใหม่",
  "topbar.open": "เปิด",
  "topbar.save": "บันทึก",
  "topbar.fullscreen": "เต็มหน้าจอ",
  "topbar.exitFullscreen": "ออกจากโหมดเต็มหน้าจอ",
  "topbar.newAnalysis": "การวิเคราะห์ใหม่",
  "topbar.unsavedFile": "ไฟล์ .gta ที่ยังไม่ได้บันทึก",
  "topbar.tooltipNew": "เริ่มการวิเคราะห์ใหม่",
  "topbar.tooltipOpen": "เปิดไฟล์วิเคราะห์ .gta ที่บันทึกไว้",
  "topbar.tooltipSave": "บันทึกการวิเคราะห์ปัจจุบัน",
  "topbar.edited": "— แก้ไขแล้ว",
  "topbar.agentsAndMcp": "เอเจนต์และ MCP",
  "topbar.setupAgentsMcp": "ตั้งค่าเอเจนต์และ MCP",
  "topbar.connected": "เชื่อมต่อแล้ว",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "อัปเดตซอฟต์แวร์",
  "updater.dismiss": "ปิดทิ้ง",
  "updater.current": "ปัจจุบัน",
  "updater.latest": "ล่าสุด",
  "updater.unknown": "ไม่ทราบ",
  "updater.checking": "กำลังตรวจสอบ...",
  "updater.downloadProgress": "ความคืบหน้าการดาวน์โหลด",
  "updater.checkAgain": "ตรวจสอบอีกครั้ง",
  "updater.restartInstall": "รีสตาร์ทและติดตั้ง",
  "updater.installing": "กำลังติดตั้ง...",
  "updater.releaseDate": "วันที่เผยแพร่: {{date}}",
  "updater.restartHint":
    "รีสตาร์ทเพื่อใช้งานอัปเดต การเปิดใหม่โดยปกติใช้เวลา 10-15 วินาที",
  "updater.unknownError": "ข้อผิดพลาดของตัวอัปเดตที่ไม่ทราบสาเหตุ",
  "updater.title.checking": "กำลังตรวจสอบอัปเดต",
  "updater.title.available": "พบอัปเดต",
  "updater.title.downloading": "กำลังดาวน์โหลดอัปเดต",
  "updater.title.downloaded": "พร้อมติดตั้ง",
  "updater.title.error": "อัปเดตล้มเหลว",
  "updater.subtitle.checking": "กำลังค้นหาเวอร์ชันล่าสุด...",
  "updater.subtitle.available": "เวอร์ชัน {{version}} พร้อมใช้งาน",
  "updater.subtitle.availableGeneric": "มีเวอร์ชันใหม่พร้อมใช้งาน",
  "updater.subtitle.downloading":
    "เวอร์ชัน {{version}} กำลังดาวน์โหลดในพื้นหลัง",
  "updater.subtitle.downloadingGeneric":
    "กำลังดาวน์โหลดแพ็คเกจอัปเดตในพื้นหลัง",
  "updater.subtitle.downloaded": "เวอร์ชัน {{version}} ดาวน์โหลดเสร็จแล้ว",
  "updater.subtitle.downloadedGeneric": "ดาวน์โหลดอัปเดตเสร็จแล้ว",
  "updater.subtitle.error": "ไม่สามารถตรวจสอบหรือดาวน์โหลดอัปเดตได้",

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
  "ai.newChat": "แชทใหม่",
  "ai.collapse": "ย่อ",
  "ai.generating": "กำลังสร้าง...",
  "ai.stopGenerating": "หยุดการสร้าง",
  "ai.sendMessage": "ส่งข้อความ",
  "ai.loadingModels": "กำลังโหลดโมเดล...",
  "ai.noModelsConnected": "ไม่มีโมเดลที่เชื่อมต่อ",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "ตั้งค่าเอเจนต์และ MCP",
  "agents.agentsOnCanvas": "เอเจนต์บนแคนวาส",
  "agents.mcpIntegrations": "การผสานรวม MCP ในเทอร์มินัล",
  "agents.port": "พอร์ต",
  "agents.mcpRestart": "การผสานรวม MCP จะมีผลหลังจากรีสตาร์ทเทอร์มินัล",
  "agents.modelCount": "{{count}} โมเดล",
  "agents.connectionFailed": "การเชื่อมต่อล้มเหลว",
  "agents.serverError": "ข้อผิดพลาดของเซิร์ฟเวอร์ {{status}}",
  "agents.failedTo": "{{action}} ล้มเหลว",
  "agents.failedToMcp": "เซิร์ฟเวอร์ MCP {{action}} ล้มเหลว",
  "agents.claudeModels": "โมเดล Claude",
  "agents.openaiModels": "โมเดล OpenAI",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ ผู้ให้บริการ LLM",
  "agents.mcpServer": "เซิร์ฟเวอร์ MCP",
  "agents.mcpServerStop": "หยุด",
  "agents.mcpServerRunning": "กำลังทำงาน",
  "agents.mcpServerStopped": "หยุดแล้ว",
  "agents.mcpClientConfig": "การตั้งค่าไคลเอนต์",
  "agents.autoUpdate": "ตรวจสอบอัปเดตอัตโนมัติ",
  "agents.notInstalled": "ยังไม่ได้ติดตั้ง",
  "agents.install": "ติดตั้ง",
  "agents.installing": "กำลังติดตั้ง...",
  "agents.installFailed": "การติดตั้งล้มเหลว",
  "agents.viewDocs": "เอกสาร",
  "agents.analysisRuntime": "รันไทม์การวิเคราะห์",
  "agents.analysisWebSearch": "ค้นหาเว็บ",
  "agents.analysisWebSearchHint": "ใช้การค้นคว้าเว็บสดระหว่างการรันวิเคราะห์",
  "agents.analysisEffort": "ความเข้มข้นการวิเคราะห์",
  "agents.analysisEffortHint":
    "ควบคุมแนวทางความลึกของการวิเคราะห์สำหรับการรัน ไม่ใช่การเลือกโมเดล",
  "agents.analysisEffortQuick": "รวดเร็ว",
  "agents.analysisEffortStandard": "มาตรฐาน",
  "agents.analysisEffortThorough": "ละเอียด",
  "agents.analysisPhases": "การเลือกเฟส",
  "agents.analysisPhasesHint":
    "การรันเฟสแบบกำหนดเองจะรันเฉพาะเฟสที่เลือกและอาจปิดการตรวจสอบซ้ำอัตโนมัติแบบปลายน้ำ",
  "agents.analysisPhasesAll": "ทุกเฟส",
  "agents.analysisPhasesCustom": "กำหนดเอง",
  "agents.customProvider": "API ที่กำหนดเอง",
  "agents.customProviderDesc": "เอนด์พอยต์ใด ๆ ที่รองรับ OpenAI — OpenCode Go/Zen, OpenRouter, DeepSeek หรือ URL ของคุณเอง",
  "agents.customPreset": "ค่าที่ตั้งไว้ล่วงหน้าของผู้ให้บริการ",
  "agents.customBaseUrl": "URL ฐาน",
  "agents.customApiKey": "คีย์ API",
  "agents.customModelIds": "รหัสโมเดล (คั่นด้วยเครื่องหมายจุลภาค ไม่บังคับ)",
  "agents.customNativeSearch": "โมเดลมีการค้นหาเว็บในตัว",
  "agents.customNativeSearchHint": "เมื่อเปิด เครื่องมือค้นหาเว็บของแอปจะไม่ถูกเสนอให้กับเอนด์พอยต์นี้",
  "agents.customModels": "โมเดลที่กำหนดเอง",
  "agents.searchProvider": "ผู้ให้บริการค้นหา",
  "agents.searchApiKey": "คีย์ API การค้นหา",
  "agents.searchKeyHint": "การวิจัยเว็บแบบสดต้องใช้คีย์ของผู้ให้บริการค้นหา (Tavily หรือ Brave)",
  "agents.customKeyStoredPlain": "เบราว์เซอร์นี้จัดเก็บคีย์แบบไม่เข้ารหัส ใช้แอปเดสก์ท็อปสำหรับการจัดเก็บแบบเข้ารหัส",
  "agents.customKeyNotEncrypted": "การเข้ารหัสของระบบปฏิบัติการไม่พร้อมใช้งาน คีย์จึงไม่ถูกบันทึก เปิดใช้งานพวงกุญแจของระบบแล้วลองอีกครั้ง",
  "agents.customConnect": "เชื่อมต่อ",
  "agents.searchProviderNone": "ไม่มี",
  "agents.customClearKey": "ล้างคีย์ API",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "ไม่พบหน้านี้",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "นักวิเคราะห์ทฤษฎีเกม",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "ไม่สามารถเปลี่ยนโมเดลขณะกำลังวิเคราะห์ หยุดการวิเคราะห์ก่อน",
  "analysis.unsavedChanges":
    "คุณมีการเปลี่ยนแปลงการวิเคราะห์ที่ยังไม่ได้บันทึก ต้องการยกเลิกและเริ่มการวิเคราะห์ใหม่หรือไม่?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "กำลังเตรียมการวิเคราะห์เฟส",
  "analysis.activity.researching": "กำลังค้นคว้าหลักฐาน",
  "analysis.activity.synthesizing": "กำลังสังเคราะห์ผลลัพธ์เฟส",
  "analysis.activity.validating": "กำลังตรวจสอบผลลัพธ์ที่มีโครงสร้าง",
  "analysis.activity.retrying":
    "กำลังลองเฟสอีกครั้งหลังจากปัญหาการตรวจสอบหรือการส่งข้อมูล",
  "analysis.activity.default": "กำลังดำเนินการวิเคราะห์เฟส",
  "analysis.activity.usingTool": "กำลังใช้ {{toolName}}",
  "analysis.activity.usingWebSearchQuery":
    "กำลังใช้ WebSearch: {{query}}",
  "analysis.activity.agentProgress": "ความคืบหน้าของเอเจนต์",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "เฟส {{number}} ล้มเหลว",
  "analysis.progress.phaseLabel": "เฟส {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} เฟสเสร็จสมบูรณ์",
  "analysis.progress.entityCount": "{{count}} เอนทิตี",
  "analysis.progress.entityCountPlural": "{{count}} เอนทิตี",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "หมดเวลา",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "ข้อผิดพลาดของผู้ให้บริการ",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "การวางรากฐานสถานการณ์",
  "analysis.phases.playerIdentification": "การระบุผู้เล่น",
  "analysis.phases.baselineModel": "โมเดลพื้นฐาน",
  "analysis.phases.historicalGame": "เกมเชิงประวัติศาสตร์",
  "analysis.phases.revalidation": "การตรวจสอบซ้ำ",
  "analysis.phases.formalModeling": "การสร้างแบบจำลองอย่างเป็นทางการ",
  "analysis.phases.assumptions": "สมมติฐาน",
  "analysis.phases.elimination": "การกำจัด",
  "analysis.phases.scenarios": "สถานการณ์จำลอง",
  "analysis.phases.metaCheck": "การตรวจสอบเชิงอภิมาน",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "รันเฟสอีกครั้ง",
  "analysis.sidebar.searchEntities": "ค้นหาเอนทิตี...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "ข้อเท็จจริง",
  "analysis.entities.player": "ผู้เล่น",
  "analysis.entities.objective": "วัตถุประสงค์",
  "analysis.entities.game": "เกม",
  "analysis.entities.strategy": "กลยุทธ์",
  "analysis.entities.payoff": "ผลตอบแทน",
  "analysis.entities.rule": "กฎ",
  "analysis.entities.escalation": "การยกระดับ",
  "analysis.entities.history": "ประวัติ",
  "analysis.entities.pattern": "รูปแบบ",
  "analysis.entities.trust": "ความไว้วางใจ",
  "analysis.entities.commitment": "พันธสัญญา",
  "analysis.entities.signal": "สัญญาณ",
  "analysis.entities.matrix": "เมทริกซ์",
  "analysis.entities.gameTree": "ต้นไม้เกม",
  "analysis.entities.equilibrium": "ดุลยภาพ",
  "analysis.entities.constraints": "ข้อจำกัด",
  "analysis.entities.crossGame": "ข้ามเกม",
  "analysis.entities.signalClass": "ประเภทสัญญาณ",
  "analysis.entities.bargaining": "การต่อรอง",
  "analysis.entities.optionValue": "มูลค่าทางเลือก",
  "analysis.entities.behavioral": "เชิงพฤติกรรม",
  "analysis.entities.assumption": "สมมติฐาน",
  "analysis.entities.eliminated": "ถูกกำจัด",
  "analysis.entities.scenario": "สถานการณ์จำลอง",
  "analysis.entities.thesis": "วิทยานิพนธ์",
  "analysis.entities.metaCheck": "การตรวจสอบเชิงอภิมาน",
  "analysis.entities.confidence.high": "สูง",
  "analysis.entities.confidence.medium": "ปานกลาง",
  "analysis.entities.confidence.low": "ต่ำ",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "มนุษย์",
} as const;

export default th;
