import type { TranslationKeys } from "./en";

const th: TranslationKeys = {
  // ── Common ──
  "common.rename": "เปลี่ยนชื่อ",
  "common.duplicate": "ทำซ้ำ",
  "common.delete": "ลบ",
  "common.cancel": "ยกเลิก",
  "common.save": "บันทึก",
  "common.close": "ปิด",
  "common.connect": "เชื่อมต่อ",
  "common.disconnect": "ตัดการเชื่อมต่อ",
  "common.import": "นำเข้า",
  "common.export": "ส่งออก",
  "common.name": "ชื่อ",
  "common.untitled": "ไม่มีชื่อ",
  "common.best": "ดีที่สุด",
  "common.selected": "เลือกแล้ว {{count}} รายการ",

  // ── Toolbar ──
  "toolbar.select": "เลือก",
  "toolbar.text": "ข้อความ",
  "toolbar.frame": "เฟรม",
  "toolbar.hand": "มือ",
  "toolbar.undo": "เลิกทำ",
  "toolbar.redo": "ทำซ้ำ",
  "toolbar.variables": "ตัวแปร",
  "toolbar.uikitBrowser": "เบราว์เซอร์ UIKit",

  // ── Shapes ──
  "shapes.rectangle": "สี่เหลี่ยมผืนผ้า",
  "shapes.ellipse": "วงรี",
  "shapes.polygon": "รูปหลายเหลี่ยม",
  "shapes.line": "เส้น",
  "shapes.icon": "ไอคอน",
  "shapes.importImageSvg": "นำเข้ารูปภาพหรือ SVG\u2026",
  "shapes.pen": "ปากกา",
  "shapes.shapeTools": "เครื่องมือรูปทรง",
  "shapes.moreShapeTools": "เครื่องมือรูปทรงเพิ่มเติม",

  // ── Top Bar ──
  "topbar.hideLayers": "ซ่อนโครงร่าง",
  "topbar.showLayers": "แสดงโครงร่าง",
  "topbar.new": "ใหม่",
  "topbar.open": "เปิด",
  "topbar.save": "บันทึก",
  "topbar.importFigma": "นำเข้า Figma",
  "topbar.codePanel": "โค้ด",
  "topbar.fullscreen": "เต็มหน้าจอ",
  "topbar.exitFullscreen": "ออกจากโหมดเต็มหน้าจอ",
  "topbar.newAnalysis": "การวิเคราะห์ใหม่",
  "topbar.unsavedFile": "ไฟล์ .gta ที่ยังไม่ได้บันทึก",
  "topbar.complete": "เสร็จสมบูรณ์",
  "topbar.incomplete": "เหลืออีก {{count}} เซลล์",
  "topbar.issues": "{{count}} ปัญหา",
  "topbar.tooltipNew": "เริ่มการวิเคราะห์ใหม่",
  "topbar.tooltipOpen": "เปิดไฟล์วิเคราะห์ .gta ที่บันทึกไว้",
  "topbar.tooltipSave": "บันทึกการวิเคราะห์ปัจจุบัน",
  "topbar.edited": "— แก้ไขแล้ว",
  "topbar.agentsAndMcp": "เอเจนต์และ MCP",
  "topbar.setupAgentsMcp": "ตั้งค่าเอเจนต์และ MCP",
  "topbar.connected": "เชื่อมต่อแล้ว",
  "topbar.agentStatus": "{{agents}} เอเจนต์{{agentSuffix}} · {{mcp}} MCP",

  // ── Right Panel ──
  "rightPanel.design": "รายละเอียด",
  "rightPanel.code": "โค้ด",
  "rightPanel.noSelection": "เลือกรายการ",

  // ── Pages ──
  "pages.title": "หน้า",
  "pages.addPage": "เพิ่มหน้า",
  "pages.moveUp": "ย้ายขึ้น",
  "pages.moveDown": "ย้ายลง",

  // ── Status Bar ──
  "statusbar.zoomOut": "ซูมออก",
  "statusbar.zoomIn": "ซูมเข้า",
  "statusbar.resetZoom": "รีเซ็ตการซูม",

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
  "layers.title": "โครงร่าง",
  "layers.empty": "ยังไม่มีรายการ ใช้แถบเครื่องมือเพื่อเริ่มสร้าง",

  // ── Layer Context Menu ──
  "layerMenu.groupSelection": "จัดกลุ่มที่เลือก",
  "layerMenu.createComponent": "สร้างคอมโพเนนต์",
  "layerMenu.detachComponent": "แยกคอมโพเนนต์",
  "layerMenu.detachInstance": "แยกอินสแตนซ์",
  "layerMenu.booleanUnion": "รวม",
  "layerMenu.booleanSubtract": "ลบ",
  "layerMenu.booleanIntersect": "ตัดกัน",
  "layerMenu.toggleLock": "สลับล็อก",
  "layerMenu.toggleVisibility": "สลับการมองเห็น",

  // ── Property Panel ──
  "property.createComponent": "สร้างคอมโพเนนต์",
  "property.detachComponent": "แยกคอมโพเนนต์",
  "property.goToComponent": "ไปที่คอมโพเนนต์",
  "property.detachInstance": "แยกอินสแตนซ์",

  // ── Fill ──
  "fill.title": "สีพื้น",
  "fill.solid": "ทึบ",
  "fill.linear": "เชิงเส้น",
  "fill.radial": "วงกลม",
  "fill.image": "รูปภาพ",
  "fill.stops": "จุดหยุด",
  "fill.angle": "มุม",

  // ── Image ──
  "image.title": "รูปภาพ",
  "image.fit": "โหมดปรับขนาด",
  "image.fill": "เติมเต็ม",
  "image.fitMode": "พอดี",
  "image.crop": "ครอป",
  "image.tile": "เรียงต่อ",
  "image.clickToUpload": "คลิกเพื่ออัปโหลด",
  "image.changeImage": "เปลี่ยนรูปภาพ",
  "image.adjustments": "การปรับแต่ง",
  "image.exposure": "การเปิดรับแสง",
  "image.contrast": "คอนทราสต์",
  "image.saturation": "ความอิ่มตัว",
  "image.temperature": "อุณหภูมิสี",
  "image.tint": "โทนสี",
  "image.highlights": "ไฮไลท์",
  "image.shadows": "เงา",
  "image.reset": "รีเซ็ต",

  // ── Stroke ──
  "stroke.title": "เส้นขอบ",

  // ── Appearance ──
  "appearance.layer": "เลเยอร์",
  "appearance.opacity": "ความทึบ",

  // ── Layout ──
  "layout.flexLayout": "เลย์เอาต์ยืดหยุ่น",
  "layout.freedom": "อิสระ (ไม่มีเลย์เอาต์)",
  "layout.vertical": "เลย์เอาต์แนวตั้ง",
  "layout.horizontal": "เลย์เอาต์แนวนอน",
  "layout.alignment": "การจัดตำแหน่ง",
  "layout.gap": "ช่องว่าง",
  "layout.spaceBetween": "เว้นระหว่าง",
  "layout.spaceAround": "เว้นรอบ",
  "layout.dimensions": "ขนาด",
  "layout.fillWidth": "เต็มความกว้าง",
  "layout.fillHeight": "เต็มความสูง",
  "layout.hugWidth": "พอดีความกว้าง",
  "layout.hugHeight": "พอดีความสูง",
  "layout.clipContent": "ตัดเนื้อหา",

  // ── Padding ──
  "padding.title": "ระยะขอบใน",
  "padding.paddingMode": "โหมดระยะขอบใน",
  "padding.paddingValues": "ค่าระยะขอบใน",
  "padding.oneValue": "ค่าเดียวสำหรับทุกด้าน",
  "padding.horizontalVertical": "แนวนอน/แนวตั้ง",
  "padding.topRightBottomLeft": "บน/ขวา/ล่าง/ซ้าย",

  // ── Typography ──
  "text.typography": "ตัวอักษร",
  "text.lineHeight": "ความสูงบรรทัด",
  "text.letterSpacing": "ระยะห่างตัวอักษร",
  "text.horizontal": "แนวนอน",
  "text.vertical": "แนวตั้ง",
  "text.alignLeft": "จัดชิดซ้าย",
  "text.alignCenter": "จัดกึ่งกลาง",
  "text.alignRight": "จัดชิดขวา",
  "text.justify": "จัดเต็มบรรทัด",
  "text.top": "บน",
  "text.middle": "กลาง",
  "text.bottom": "ล่าง",
  "text.weight.thin": "บาง",
  "text.weight.light": "เบา",
  "text.weight.regular": "ปกติ",
  "text.weight.medium": "ปานกลาง",
  "text.weight.semibold": "กึ่งหนา",
  "text.weight.bold": "หนา",
  "text.weight.black": "หนามาก",
  "text.font.search": "ค้นหาฟอนต์\u2026",
  "text.font.bundled": "แบบรวม",
  "text.font.system": "ระบบ",
  "text.font.loading": "กำลังโหลดฟอนต์\u2026",
  "text.font.noResults": "ไม่พบฟอนต์",

  // ── Text Layout ──
  "textLayout.title": "เลย์เอาต์",
  "textLayout.dimensions": "ขนาด",
  "textLayout.resizing": "การปรับขนาด",
  "textLayout.autoWidth": "กว้างอัตโนมัติ",
  "textLayout.autoWidthDesc": "ความกว้างอัตโนมัติ \u2014 ข้อความขยายในแนวนอน",
  "textLayout.autoHeight": "สูงอัตโนมัติ",
  "textLayout.autoHeightDesc":
    "ความสูงอัตโนมัติ \u2014 ความกว้างคงที่ ความสูงปรับอัตโนมัติ",
  "textLayout.fixed": "คงที่",
  "textLayout.fixedDesc": "ขนาดคงที่ \u2014 ทั้งความกว้างและความสูงคงที่",
  "textLayout.fillWidth": "เต็มความกว้าง",
  "textLayout.fillHeight": "เต็มความสูง",

  // ── Effects ──
  "effects.title": "เอฟเฟกต์",
  "effects.dropShadow": "เงาตกกระทบ",
  "effects.blur": "เบลอ",
  "effects.spread": "การกระจาย",
  "effects.color": "สี",

  // ── Export ──
  "export.title": "ส่งออก",
  "export.format": "รูปแบบ",
  "export.scale": "สเกล",
  "export.selectedOnly": "ส่งออกเฉพาะที่เลือก",
  "export.exportFormat": "ส่งออก {{format}}",
  "export.exportLayer": "ส่งออกเลเยอร์",

  // ── Polygon ──
  "polygon.sides": "ด้าน",

  // ── Ellipse ──
  "ellipse.start": "เริ่ม",
  "ellipse.sweep": "กวาด",
  "ellipse.innerRadius": "ภายใน",

  // ── Corner Radius ──
  "cornerRadius.title": "รัศมีมุม",

  // ── Size / Position ──
  "size.position": "ตำแหน่ง",

  // ── Icon ──
  "icon.title": "ไอคอน",
  "icon.searchIcons": "ค้นหาไอคอน...",
  "icon.noIconsFound": "ไม่พบไอคอน",
  "icon.typeToSearch": "พิมพ์เพื่อค้นหาไอคอน Iconify",
  "icon.iconsCount": "{{count}} ไอคอน",

  // ── Variables Panel ──
  "variables.addTheme": "เพิ่มธีม",
  "variables.addVariant": "เพิ่มตัวเลือก",
  "variables.addVariable": "เพิ่มตัวแปร",
  "variables.searchVariables": "ค้นหาตัวแปร...",
  "variables.noMatch": "ไม่มีตัวแปรที่ตรงกับการค้นหาของคุณ",
  "variables.noDefined": "ยังไม่มีตัวแปรที่กำหนดไว้",
  "variables.closeShortcut": "ปิด (\u2318\u21e7V)",
  "variables.presets": "พรีเซ็ต",
  "variables.savePreset": "บันทึกเป็นพรีเซ็ต…",
  "variables.loadPreset": "โหลดพรีเซ็ต",
  "variables.importPreset": "นำเข้าจากไฟล์…",
  "variables.exportPreset": "ส่งออกเป็นไฟล์…",
  "variables.presetName": "ชื่อพรีเซ็ต",
  "variables.noPresets": "ไม่มีพรีเซ็ตที่บันทึกไว้",

  // ── AI Chat ──
  "ai.newChat": "แชทใหม่",
  "ai.collapse": "ย่อ",
  "ai.tryExample": "ลองใช้พรอมต์พื้นที่ทำงาน...",
  "ai.tipSelectElements":
    "เคล็ดลับ: เลือกรายการในพื้นที่ทำงานก่อนแชทเพื่อให้บริบท",
  "ai.generating": "กำลังสร้าง...",
  "ai.designWithAgent": "ถามเอเจนต์เกี่ยวกับพื้นที่ทำงานนี้...",
  "ai.attachImage": "แนบรูปภาพ",
  "ai.stopGenerating": "หยุดการสร้าง",
  "ai.sendMessage": "ส่งข้อความ",
  "ai.loadingModels": "กำลังโหลดโมเดล...",
  "ai.noModelsConnected": "ไม่มีโมเดลที่เชื่อมต่อ",
  "ai.quickAction.loginScreen": "สรุปพื้นที่ทำงานนี้",
  "ai.quickAction.loginScreenPrompt":
    "สรุปพื้นที่ทำงานปัจจุบันและรายการหลักที่มองเห็นในบริบทเอกสาร",
  "ai.quickAction.foodApp": "อธิบายสิ่งที่เลือก",
  "ai.quickAction.foodAppPrompt":
    "อธิบายรายการที่เลือกอยู่ในขณะนี้และโครงสร้างสำคัญที่คุณสังเกตเห็น",
  "ai.quickAction.bottomNav": "แนะนำขั้นตอนถัดไป",
  "ai.quickAction.bottomNavPrompt":
    "จากพื้นที่ทำงานปัจจุบัน แนะนำสามขั้นตอนถัดไปที่เป็นรูปธรรม",
  "ai.quickAction.colorPalette": "อธิบายเอเจนต์ที่มี",
  "ai.quickAction.colorPalettePrompt":
    "อธิบายว่าเอเจนต์และเครื่องมือ MCP ที่เชื่อมต่ออยู่ตอนนี้มีอะไรบ้าง และช่วยอะไรได้ในพื้นที่ทำงานนี้",

  // ── Code Panel ──
  "code.reactTailwind": "React + Tailwind",
  "code.htmlCss": "HTML + CSS",
  "code.cssVariables": "CSS Variables",
  "code.copyClipboard": "คัดลอกไปยังคลิปบอร์ด",
  "code.copied": "คัดลอกแล้ว!",
  "code.download": "ดาวน์โหลดไฟล์โค้ด",
  "code.closeCodePanel": "ปิดแผงโค้ด",
  "code.genCssVars": "กำลังสร้าง CSS Variables สำหรับเอกสารทั้งหมด",
  "code.genSelected": "กำลังสร้างโค้ดสำหรับ {{count}} องค์ประกอบที่เลือก",
  "code.genDocument": "กำลังสร้างโค้ดสำหรับเอกสารทั้งหมด",
  "code.aiEnhance": "ปรับปรุงด้วย AI",
  "code.cancelEnhance": "ยกเลิกการปรับปรุง",
  "code.resetEnhance": "กลับเป็นต้นฉบับ",
  "code.enhancing": "AI กำลังปรับปรุงโค้ด...",
  "code.enhanced": "ปรับปรุงแล้วโดย AI",

  // ── Save Dialog ──
  "save.saveAs": "บันทึกเป็น",
  "save.fileName": "ชื่อไฟล์",

  // ── Agent Settings ──
  "agents.title": "ตั้งค่าเอเจนต์และ MCP",
  "agents.agentsOnCanvas": "เอเจนต์บนแคนวาส",
  "agents.mcpIntegrations": "การผสานรวม MCP ในเทอร์มินัล",
  "agents.transport": "การส่งข้อมูล",
  "agents.port": "พอร์ต",
  "agents.mcpRestart": "การผสานรวม MCP จะมีผลหลังจากรีสตาร์ทเทอร์มินัล",
  "agents.modelCount": "{{count}} โมเดล",
  "agents.connectionFailed": "การเชื่อมต่อล้มเหลว",
  "agents.serverError": "ข้อผิดพลาดของเซิร์ฟเวอร์ {{status}}",
  "agents.failedTo": "{{action}} ล้มเหลว",
  "agents.failedToMcp": "เซิร์ฟเวอร์ MCP {{action}} ล้มเหลว",
  "agents.failedTransport": "อัปเดตการส่งข้อมูลล้มเหลว",
  "agents.failedMcpTransport": "อัปเดตการส่งข้อมูล MCP ล้มเหลว",
  "agents.claudeCode": "Claude Code",
  "agents.claudeModels": "โมเดล Claude",
  "agents.codexCli": "Codex CLI",
  "agents.openaiModels": "โมเดล OpenAI",
  "agents.mcpServer": "เซิร์ฟเวอร์ MCP",
  "agents.mcpServerStart": "เริ่ม",
  "agents.mcpServerStop": "หยุด",
  "agents.mcpServerRunning": "กำลังทำงาน",
  "agents.mcpServerStopped": "หยุดแล้ว",
  "agents.mcpLanAccess": "เข้าถึง LAN",
  "agents.mcpClientConfig": "การตั้งค่าไคลเอนต์",
  "agents.stdio": "stdio",
  "agents.http": "http",
  "agents.stdioHttp": "stdio + http",
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

  // ── Figma Import ──
  "figma.title": "นำเข้าจาก Figma",
  "figma.dropFile": "วางไฟล์ .fig ที่นี่",
  "figma.orBrowse": "หรือคลิกเพื่อเรียกดู",
  "figma.exportTip": "ส่งออกจาก Figma: File \u2192 Save local copy (.fig)",
  "figma.selectFigFile": "กรุณาเลือกไฟล์ .fig",
  "figma.noPages": "ไม่พบหน้าในไฟล์ .fig",
  "figma.parseFailed": "ไม่สามารถแยกวิเคราะห์ไฟล์ .fig ได้",
  "figma.convertFailed": "ไม่สามารถแปลงไฟล์ Figma ได้",
  "figma.parsing": "กำลังแยกวิเคราะห์ไฟล์ .fig...",
  "figma.converting": "กำลังแปลงโหนด...",
  "figma.selectPage": "ไฟล์นี้มี {{count}} หน้า เลือกหน้าที่จะนำเข้า:",
  "figma.layers": "{{count}} เลเยอร์",
  "figma.importAll": "นำเข้าทุกหน้า",
  "figma.importComplete": "นำเข้าเสร็จสมบูรณ์!",
  "figma.moreWarnings": "...และอีก {{count}} คำเตือน",
  "figma.tryAgain": "ลองอีกครั้ง",
  "figma.layoutMode": "โหมดเลย์เอาต์:",
  "figma.preserveLayout": "คงเลย์เอาต์ Figma ไว้",
  "figma.autoLayout": "เลย์เอาต์อัตโนมัติ OpenPencil",
  "figma.comingSoon": "เร็ว ๆ นี้",

  // ── Landing Page ──
  "landing.title": "Game Theory ",
  "landing.titleAccent": "Analysis",
  "landing.tagline": "Manual strategic analysis for two-player games.",
  "landing.openAnalysis": "Open Analysis",
  "landing.shortcutHint": "Press {{key1}} + {{key2}} to start a new analysis",

  // ── 404 ──
  "notFound.message": "ไม่พบหน้านี้",

  // ── Component Browser ──
  "componentBrowser.title": "เบราว์เซอร์ UIKit",
  "componentBrowser.exportKit": "ส่งออกชุด",
  "componentBrowser.importKit": "นำเข้าชุด",
  "componentBrowser.kit": "ชุด:",
  "componentBrowser.all": "ทั้งหมด",
  "componentBrowser.imported": "(นำเข้าแล้ว)",
  "componentBrowser.components": "คอมโพเนนต์",
  "componentBrowser.searchComponents": "ค้นหาคอมโพเนนต์...",
  "componentBrowser.deleteKit": "ลบ {{name}}",
  "componentBrowser.category.all": "ทั้งหมด",
  "componentBrowser.category.buttons": "ปุ่ม",
  "componentBrowser.category.inputs": "อินพุต",
  "componentBrowser.category.cards": "การ์ด",
  "componentBrowser.category.nav": "นำทาง",
  "componentBrowser.category.layout": "เลย์เอาต์",
  "componentBrowser.category.feedback": "การตอบกลับ",
  "componentBrowser.category.data": "ข้อมูล",
  "componentBrowser.category.other": "อื่น ๆ",

  // ── Variable Picker ──
  "variablePicker.boundTo": "ผูกกับ --{{name}}",
  "variablePicker.bindToVariable": "ผูกกับตัวแปร",
  "variablePicker.unbind": "ยกเลิกการผูกตัวแปร",
  "variablePicker.noVariables": "ยังไม่มีตัวแปร {{type}} ที่กำหนดไว้",

  // ── Analysis ──
  "analysis.title": "นักวิเคราะห์ทฤษฎีเกม",
  "analysis.emptyState":
    "ฉันเป็นนักวิเคราะห์ทฤษฎีเกมของคุณ คุณต้องการวิเคราะห์เหตุการณ์ใด?",
  "analysis.emptyHint": "ฉันจะระบุผู้เล่น กลยุทธ์ และโครงสร้างเกมโดยอัตโนมัติ",
  "analysis.inputPlaceholder": "อธิบายเหตุการณ์ที่ต้องการวิเคราะห์...",
  "analysis.startingAnalysis":
    'กำลังเริ่มการวิเคราะห์เชิงทฤษฎีเกมของ "{{topic}}"...',
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
  "analysis.activity.usingWebSearchQuery": "กำลังใช้ WebSearch: {{query}}",
  "analysis.activity.agentProgress": "ความคืบหน้าของเอเจนต์",

  // ── Analysis Progress ──
  "analysis.progress.phaseFailed": "เฟส {{number}} ล้มเหลว",
  "analysis.progress.phaseLabel": "เฟส {{number}}: {{name}}",
  "analysis.progress.phasesComplete": "{{completed}}/{{total}} เฟสเสร็จสมบูรณ์",
  "analysis.progress.entityCount": "{{count}} เอนทิตี",
  "analysis.progress.entityCountPlural": "{{count}} เอนทิตี",

  // ── Analysis Failures ──
  "analysis.failure.timeout": "หมดเวลา",
  "analysis.failure.parseError": "ข้อผิดพลาดในการแยกวิเคราะห์",
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
  "analysis.entities.noMatching": "ไม่มีเอนทิตีที่ตรงกัน",
  "analysis.entities.searchHint": "ลองใช้คำค้นหาอื่นหรือลบตัวกรองประเภท",
  "analysis.entities.confidence.high": "สูง",
  "analysis.entities.confidence.medium": "ปานกลาง",
  "analysis.entities.confidence.low": "ต่ำ",
  "analysis.entities.source.ai": "AI",
  "analysis.entities.source.human": "มนุษย์",
  "analysis.entities.source.computed": "คำนวณ",
} as const;

export default th;
