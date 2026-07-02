import type { TranslationKeys } from "./en";

const hi: TranslationKeys = {
  // ── Common ──
  "common.connect": "कनेक्ट करें",
  "common.disconnect": "डिस्कनेक्ट करें",
  "common.best": "सर्वश्रेष्ठ",

  // ── Toolbar ──

  // ── Shapes ──

  // ── Top Bar ──
  "topbar.new": "नया",
  "topbar.open": "खोलें",
  "topbar.save": "सहेजें",
  "topbar.fullscreen": "पूर्ण स्क्रीन",
  "topbar.exitFullscreen": "पूर्ण स्क्रीन से बाहर निकलें",
  "topbar.newAnalysis": "नया विश्लेषण",
  "topbar.unsavedFile": "असहेजी .gta फ़ाइल",
  "topbar.tooltipNew": "एक नया विश्लेषण शुरू करें",
  "topbar.tooltipOpen": "सहेजा गया .gta विश्लेषण खोलें",
  "topbar.tooltipSave": "वर्तमान विश्लेषण सहेजें",
  "topbar.edited": "— संपादित",
  "topbar.agentsAndMcp": "एजेंट और MCP",
  "topbar.setupAgentsMcp": "एजेंट और MCP सेटअप करें",
  "topbar.connected": "कनेक्टेड",

  // ── Right Panel ──

  // ── Pages ──

  // ── Status Bar ──

  // ── Updater ──
  "updater.softwareUpdate": "सॉफ़्टवेयर अपडेट",
  "updater.dismiss": "खारिज करें",
  "updater.current": "वर्तमान",
  "updater.latest": "नवीनतम",
  "updater.unknown": "अज्ञात",
  "updater.checking": "जाँच हो रही है...",
  "updater.downloadProgress": "डाउनलोड प्रगति",
  "updater.checkAgain": "फिर से जाँचें",
  "updater.restartInstall": "पुनः आरंभ करें और इंस्टॉल करें",
  "updater.installing": "इंस्टॉल हो रहा है...",
  "updater.releaseDate": "रिलीज़ तिथि: {{date}}",
  "updater.restartHint":
    "अपडेट लागू करने के लिए पुनः आरंभ करें। पुनः लॉन्च में आमतौर पर 10-15 सेकंड लगते हैं।",
  "updater.unknownError": "अज्ञात अपडेटर त्रुटि।",
  "updater.title.checking": "अपडेट की जाँच हो रही है",
  "updater.title.available": "अपडेट मिला",
  "updater.title.downloading": "अपडेट डाउनलोड हो रहा है",
  "updater.title.downloaded": "इंस्टॉल के लिए तैयार",
  "updater.title.error": "अपडेट विफल",
  "updater.subtitle.checking": "नवीनतम रिलीज़ की खोज हो रही है...",
  "updater.subtitle.available": "संस्करण {{version}} उपलब्ध है।",
  "updater.subtitle.availableGeneric": "एक नया संस्करण उपलब्ध है।",
  "updater.subtitle.downloading":
    "संस्करण {{version}} बैकग्राउंड में डाउनलोड हो रहा है।",
  "updater.subtitle.downloadingGeneric":
    "अपडेट पैकेज बैकग्राउंड में डाउनलोड हो रहा है।",
  "updater.subtitle.downloaded": "संस्करण {{version}} डाउनलोड हो गया है।",
  "updater.subtitle.downloadedGeneric": "अपडेट डाउनलोड हो गया है।",
  "updater.subtitle.error": "अपडेट की जाँच या डाउनलोड नहीं हो सका।",

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
  "ai.newChat": "नई चैट",
  "ai.collapse": "संक्षिप्त करें",
  "ai.generating": "जनरेट हो रहा है...",
  "ai.stopGenerating": "जनरेशन रोकें",
  "ai.sendMessage": "संदेश भेजें",
  "ai.loadingModels": "मॉडल लोड हो रहे हैं...",
  "ai.noModelsConnected": "कोई मॉडल कनेक्ट नहीं है",

  // ── Code Panel ──

  // ── Save Dialog ──

  // ── Agent Settings ──
  "agents.title": "एजेंट और MCP सेटअप करें",
  "agents.agentsOnCanvas": "कैनवस पर एजेंट",
  "agents.mcpIntegrations": "टर्मिनल में MCP इंटीग्रेशन",
  "agents.port": "पोर्ट",
  "agents.mcpRestart":
    "MCP इंटीग्रेशन टर्मिनल पुनः आरंभ करने के बाद प्रभावी होंगे।",
  "agents.modelCount": "{{count}} मॉडल",
  "agents.connectionFailed": "कनेक्शन विफल",
  "agents.serverError": "सर्वर त्रुटि {{status}}",
  "agents.failedTo": "{{action}} विफल",
  "agents.failedToMcp": "MCP सर्वर {{action}} विफल",
  "agents.claudeModels": "Claude मॉडल",
  "agents.openaiModels": "OpenAI मॉडल",
  "agents.opencode": "OpenCode",
  "agents.opencodeDesc": "75+ LLM प्रदाता",
  "agents.copilot": "GitHub Copilot",
  "agents.copilotDesc": "GitHub Copilot मॉडल",
  "agents.mcpServer": "MCP सर्वर",
  "agents.mcpServerStop": "रोकें",
  "agents.mcpServerRunning": "चल रहा है",
  "agents.mcpServerStopped": "रुका हुआ",
  "agents.mcpClientConfig": "क्लाइंट कॉन्फ़िग",
  "agents.autoUpdate": "स्वचालित अपडेट जाँच",
  "agents.notInstalled": "स्थापित नहीं",
  "agents.install": "स्थापित करें",
  "agents.installing": "स्थापित हो रहा है...",
  "agents.installFailed": "स्थापना विफल",
  "agents.viewDocs": "दस्तावेज़",
  "agents.analysisRuntime": "विश्लेषण रनटाइम",
  "agents.analysisWebSearch": "वेब खोज",
  "agents.analysisWebSearchHint":
    "विश्लेषण रन के दौरान लाइव वेब रिसर्च का उपयोग करें।",
  "agents.analysisEffort": "विश्लेषण प्रयास",
  "agents.analysisEffortHint":
    "विश्लेषण रन के लिए गहराई मार्गदर्शन नियंत्रित करता है, मॉडल चयन नहीं।",
  "agents.analysisEffortQuick": "त्वरित",
  "agents.analysisEffortStandard": "मानक",
  "agents.analysisEffortThorough": "विस्तृत",
  "agents.analysisPhases": "चरण चयन",
  "agents.analysisPhasesHint":
    "कस्टम चरण रन केवल चयनित चरण चलाता है और स्वचालित डाउनस्ट्रीम पुनर्मूल्यांकन अक्षम कर सकता है।",
  "agents.analysisPhasesAll": "सभी चरण",
  "agents.analysisPhasesCustom": "कस्टम",

  // ── Figma Import ──

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "पेज नहीं मिला",

  // ── Component Browser ──

  // ── Variable Picker ──

  // ── Analysis ──
  "analysis.title": "गेम थ्योरी विश्लेषक",
  "analysis.launcherHint": "Describe a negotiation, conflict, policy fight, market contest, or strategic situation to map on the canvas.",
  "analysis.launcherInputPlaceholder": "What do you want to analyze?",
  "analysis.chatEmptyState": "Ask about game theory, explore a situation, or work out what you want to analyze.",
  "analysis.chatEmptyHint": "If the canvas is blank, I can help you scope the topic before we run the analysis.",
  "analysis.chatInputPlaceholder": "Ask a question or describe the situation...",
  "analysis.cannotChangeModel":
    "विश्लेषण चलते समय मॉडल नहीं बदला जा सकता। पहले विश्लेषण रोकें।",
  "analysis.unsavedChanges":
    "आपके पास असहेजे विश्लेषण परिवर्तन हैं। उन्हें छोड़कर नया विश्लेषण शुरू करें?",

  // ── Analysis Activity ──
  "analysis.activity.preparing": "चरण विश्लेषण की तैयारी हो रही है।",
  "analysis.activity.researching": "साक्ष्य पर शोध हो रहा है।",
  "analysis.activity.synthesizing": "चरण आउटपुट का संश्लेषण हो रहा है।",
  "analysis.activity.validating": "संरचित आउटपुट का सत्यापन हो रहा है।",
  "analysis.activity.retrying":
    "सत्यापन या ट्रांसपोर्ट त्रुटि के बाद चरण पुनः प्रयास हो रहा है।",
  "analysis.activity.default": "चरण विश्लेषण जारी है।",
  "analysis.activity.usingTool": "{{toolName}} का उपयोग हो रहा है",
  "analysis.activity.usingWebSearchQuery":
    "WebSearch का उपयोग हो रहा है: {{query}}",
  "analysis.activity.agentProgress": "एजेंट प्रगति",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "चरण {{number}} विफल",
  "analysis.progress.phaseLabel": "चरण {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} चरण पूर्ण",
  "analysis.progress.entityCount": "{{count}} सत्ता",
  "analysis.progress.entityCountPlural": "{{count}} सत्ताएँ",
  "analysis.progress.cancelled": "Analysis cancelled",
  "analysis.failure.rateLimit": "rate limited",
  "analysis.failure.providerApiError": "provider API error",
  "analysis.failure.connectorError": "connector error",
  "analysis.failure.mcpTransportError": "MCP transport error",
  "analysis.failure.validation": "validation error",
  "analysis.failure.timeout": "समय समाप्त",
  "analysis.failure.unknown": "unknown error",
  "analysis.failure.providerError": "प्रदाता त्रुटि",

  // ── Analysis Phases ──
  "analysis.phases.situationalGrounding": "परिस्थितिजन्य आधार",
  "analysis.phases.playerIdentification": "खिलाड़ी पहचान",
  "analysis.phases.baselineModel": "आधार मॉडल",
  "analysis.phases.historicalGame": "ऐतिहासिक खेल",
  "analysis.phases.revalidation": "पुनर्मूल्यांकन",
  "analysis.phases.formalModeling": "औपचारिक मॉडलिंग",
  "analysis.phases.assumptions": "पूर्वधारणाएँ",
  "analysis.phases.elimination": "उन्मूलन",
  "analysis.phases.scenarios": "परिदृश्य",
  "analysis.phases.metaCheck": "मेटा-जाँच",

  // ── Analysis Sidebar ──
  "analysis.sidebar.rerunPhase": "चरण पुनः चलाएँ",
  "analysis.sidebar.searchEntities": "सत्ताएँ खोजें...",

  // ── Analysis Entities ──
  "analysis.entities.fact": "तथ्य",
  "analysis.entities.player": "खिलाड़ी",
  "analysis.entities.objective": "उद्देश्य",
  "analysis.entities.game": "खेल",
  "analysis.entities.strategy": "रणनीति",
  "analysis.entities.payoff": "प्रतिफल",
  "analysis.entities.rule": "नियम",
  "analysis.entities.escalation": "उग्रता",
  "analysis.entities.history": "इतिहास",
  "analysis.entities.pattern": "पैटर्न",
  "analysis.entities.trust": "विश्वास",
  "analysis.entities.commitment": "प्रतिबद्धता",
  "analysis.entities.signal": "संकेत",
  "analysis.entities.matrix": "मैट्रिक्स",
  "analysis.entities.gameTree": "गेम ट्री",
  "analysis.entities.equilibrium": "संतुलन",
  "analysis.entities.constraints": "बाधाएँ",
  "analysis.entities.crossGame": "क्रॉस-गेम",
  "analysis.entities.signalClass": "संकेत वर्ग",
  "analysis.entities.bargaining": "सौदेबाज़ी",
  "analysis.entities.optionValue": "विकल्प मूल्य",
  "analysis.entities.behavioral": "व्यवहारात्मक",
  "analysis.entities.assumption": "पूर्वधारणा",
  "analysis.entities.eliminated": "उन्मूलित",
  "analysis.entities.scenario": "परिदृश्य",
  "analysis.entities.thesis": "थीसिस",
  "analysis.entities.metaCheck": "मेटा-जाँच",
  "analysis.entities.confidence.high": "उच्च",
  "analysis.entities.confidence.medium": "मध्यम",
  "analysis.entities.confidence.low": "निम्न",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "मानव",
} as const;

export default hi;
