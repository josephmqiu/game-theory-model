#!/usr/bin/env node

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import pkg from "../../package.json";
import {
  createEntity,
  updateEntity,
  createRelationship,
  getStaleEntityIds,
  removeEntity,
  removeRelationship,
} from "../../server/services/entity-graph-service";
import {
  getEntity,
  queryEntities,
  queryRelationships,
  requestLoopback,
} from "../../server/services/analysis-tools";
import type { MethodologyPhase } from "../../shared/types/methodology";
import type { RelationshipType } from "../../shared/types/entity";
import * as analysisOrchestrator from "../../server/agents/analysis-agent";
import * as revalidationService from "../../server/services/revalidation-service";
import { ALL_PHASES, V1_PHASES } from "../../src/types/methodology";
import { handleOpenDocument } from "./tools/open-document";
import { handleBatchGet } from "./tools/batch-get";
import {
  handleInsertNode,
  handleUpdateNode,
  handleDeleteNode,
  handleMoveNode,
  handleCopyNode,
  handleReplaceNode,
} from "./tools/node-crud";
import {
  handleGetVariables,
  handleSetVariables,
  handleSetThemes,
} from "./tools/variables";
import { handleImportSvg } from "./tools/import-svg";
import { handleSnapshotLayout } from "./tools/snapshot-layout";
import { handleFindEmptySpace } from "./tools/find-empty-space";
import {
  handleSaveThemePreset,
  handleLoadThemePreset,
  handleListThemePresets,
} from "./tools/theme-presets";
import {
  handleAddPage,
  handleRemovePage,
  handleRenamePage,
  handleReorderPage,
  handleDuplicatePage,
} from "./tools/pages";
import { handleBatchDesign } from "./tools/batch-design";
import { buildDesignPrompt, listPromptSections } from "./tools/design-prompt";
import { handleDesignSkeleton } from "./tools/design-skeleton";
import { handleDesignContent } from "./tools/design-content";
import { handleDesignRefine } from "./tools/design-refine";
import { handleGetSelection } from "./tools/get-selection";
import { LAYERED_DESIGN_TOOLS } from "./tools/layered-design-defs";
import { MCP_DEFAULT_PORT } from "@/constants/app";

// --- Tool definitions (shared across all Server instances) ---

// When PRODUCT_ONLY is set (e.g. by the Codex adapter), expose only the
// product-facing tool surface — not the OpenPencil design tools.
const PRODUCT_ONLY = process.env.PRODUCT_ONLY === "1";

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOL_DEFINITIONS = [
  {
    name: "open_document",
    description:
      "Open an existing .op file or connect to the live Electron canvas. Returns document metadata, context summary, and design prompt. Always call this first. Omit filePath to connect to the live canvas.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            'Absolute path to the .op file to open or create. Omit to connect to the live Electron canvas, or pass "live://canvas" explicitly.',
        },
      },
      required: [],
    },
  },
  {
    name: "batch_get",
    description:
      "Search and read nodes. With no patterns/nodeIds, returns top-level children. Search by type/name regex, or read specific IDs. " +
      "readDepth controls how deep children are included in results (default 1, use higher to see nested structure). " +
      'Returns nodes with children truncated to "..." beyond readDepth.',
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        patterns: {
          type: "array",
          description: "Search patterns to match nodes",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "Node type (frame, text, rectangle, etc.)",
              },
              name: {
                type: "string",
                description: "Regex pattern to match node name",
              },
              reusable: {
                type: "boolean",
                description: "Match reusable components",
              },
            },
          },
        },
        nodeIds: {
          type: "array",
          items: { type: "string" },
          description: "Specific node IDs to read",
        },
        parentId: {
          type: "string",
          description: "Limit search to children of this parent node",
        },
        readDepth: {
          type: "number",
          description: "How deep to include children in results (default 1)",
        },
        searchDepth: {
          type: "number",
          description:
            "How deep to search for matching nodes (default unlimited)",
        },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_selection",
    description:
      "Get the currently selected nodes on the live canvas. Returns the full node data for each selected element. " +
      "Use this to inspect what the user has selected without needing to search.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        readDepth: {
          type: "number",
          description: "How deep to include children in results (default 2)",
        },
      },
      required: [],
    },
  },
  {
    name: "insert_node",
    description:
      "Insert a new node into the document. Node types: frame, rectangle, ellipse, text, path, image, group, line, polygon, ref. " +
      'Fill is always an array: [{ type: "solid", color: "#hex" }]. ' +
      "When inserting a frame at root level and an empty root frame exists, it is auto-replaced. " +
      "Returns the final node state (after post-processing if enabled).",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        parent: {
          type: ["string", "null"] as const,
          description: "Parent node ID, or null for root level",
        },
        data: {
          type: "object",
          description:
            "PenNode data. Required: type. Key props by type:\n" +
            "- frame: width, height, layout (none|vertical|horizontal), gap, padding, justifyContent, alignItems, clipContent, children[]\n" +
            "- text: content (required), fontSize, fontWeight, fontFamily, textGrowth (auto|fixed-width), lineHeight, fill\n" +
            "- rectangle/ellipse: width, height, fill, stroke, cornerRadius\n" +
            '- path: d (SVG path string) or name (icon name like "SearchIcon"), width, height\n' +
            "- image: src (URL), width, height\n" +
            "Common: name, role, x, y, opacity, fill (array), stroke, effects, cornerRadius",
        },
        postProcess: {
          type: "boolean",
          description:
            "Apply post-processing (role defaults, icon resolution, sanitization). Always use when generating designs.",
        },
        canvasWidth: {
          type: "number",
          description:
            "Canvas width for post-processing layout (default 1200, use 375 for mobile).",
        },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: ["parent", "data"],
    },
  },
  {
    name: "update_node",
    description:
      "Update properties of an existing node. Only provided properties are shallow-merged; unmentioned properties remain unchanged. Returns the updated node state.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        nodeId: { type: "string", description: "ID of the node to update" },
        data: {
          type: "object",
          description:
            "Properties to merge into the node (fill, width, name, etc.)",
        },
        postProcess: {
          type: "boolean",
          description: "Apply post-processing after update.",
        },
        canvasWidth: {
          type: "number",
          description:
            "Canvas width for post-processing layout (default 1200).",
        },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: ["nodeId", "data"],
    },
  },
  {
    name: "delete_node",
    description: "Delete a node (and all its children) from an .op file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        nodeId: { type: "string", description: "ID of the node to delete" },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "move_node",
    description:
      "Move a node to a new parent (or root level) in an .op file. Optionally specify insertion index.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        nodeId: { type: "string", description: "ID of the node to move" },
        parent: {
          type: ["string", "null"] as const,
          description: "New parent node ID, or null for root level",
        },
        index: {
          type: "number",
          description:
            "Insertion index within the parent (default: append at end)",
        },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: ["nodeId", "parent"],
    },
  },
  {
    name: "copy_node",
    description:
      "Deep-copy an existing node (with new IDs) and insert the clone under a parent. Optionally apply property overrides.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        sourceId: { type: "string", description: "ID of the node to copy" },
        parent: {
          type: ["string", "null"] as const,
          description: "Parent node ID for the clone, or null for root level",
        },
        overrides: {
          type: "object",
          description:
            "Properties to override on the cloned node (name, x, y, etc.)",
        },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: ["sourceId", "parent"],
    },
  },
  {
    name: "replace_node",
    description:
      "Replace a node with entirely new data. The old node is removed and a new node is inserted at the same position.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        nodeId: { type: "string", description: "ID of the node to replace" },
        data: {
          type: "object",
          description:
            "Complete new PenNode data (type, name, width, height, fill, children, ...)",
        },
        postProcess: {
          type: "boolean",
          description: "Apply post-processing after replacement.",
        },
        canvasWidth: {
          type: "number",
          description:
            "Canvas width for post-processing layout (default 1200).",
        },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: ["nodeId", "data"],
    },
  },
  {
    name: "import_svg",
    description:
      "Import a local SVG file into an .op document as editable PenNodes. Supports path, rect, circle, ellipse, line, polygon, polyline, and nested groups. No network access required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        svgPath: {
          type: "string",
          description: "Absolute path to a local .svg file",
        },
        parent: {
          type: ["string", "null"] as const,
          description: "Parent node ID, or null/omit for root level",
        },
        maxDim: {
          type: "number",
          description: "Max dimension to scale SVG to (default 400)",
        },
        postProcess: {
          type: "boolean",
          description:
            "Apply post-processing (role defaults, icon resolution, sanitization).",
        },
        canvasWidth: {
          type: "number",
          description:
            "Canvas width for post-processing layout (default 1200).",
        },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: ["svgPath"],
    },
  },
  {
    name: "get_variables",
    description: "Get all design variables and themes defined in an .op file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
      },
      required: [],
    },
  },
  {
    name: "set_variables",
    description:
      "Add or update design variables in an .op file. By default merges with existing variables.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        variables: {
          type: "object",
          description: "Variables to set (name → { type, value })",
        },
        replace: {
          type: "boolean",
          description:
            "Replace all variables instead of merging (default false)",
        },
      },
      required: ["variables"],
    },
  },
  {
    name: "set_themes",
    description:
      'Create or update theme axes and their variants in an .op file. Each theme axis (e.g. "Color Scheme") has an array of variant names (e.g. ["Light", "Dark"]). Multiple independent axes are supported. By default merges with existing themes.',
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        themes: {
          type: "object",
          description:
            'Theme axes to set (axis name → variant names array). Example: { "Color": ["Light", "Dark"], "Density": ["Compact", "Comfortable"] }',
        },
        replace: {
          type: "boolean",
          description: "Replace all themes instead of merging (default false)",
        },
      },
      required: ["themes"],
    },
  },
  {
    name: "snapshot_layout",
    description:
      "Get the hierarchical bounding box layout tree of an .op file. Useful for understanding spatial arrangement.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        parentId: {
          type: "string",
          description: "Only return layout under this parent node",
        },
        maxDepth: {
          type: "number",
          description: "Max depth to traverse (default 1)",
        },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: [],
    },
  },
  {
    name: "find_empty_space",
    description:
      "Find empty canvas space in a given direction for placing new content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        width: { type: "number", description: "Required width of empty space" },
        height: {
          type: "number",
          description: "Required height of empty space",
        },
        padding: {
          type: "number",
          description: "Minimum padding from other elements (default 50)",
        },
        direction: {
          type: "string",
          enum: ["top", "right", "bottom", "left"],
          description: "Direction to search for empty space",
        },
        nodeId: {
          type: "string",
          description: "Search relative to this node (default: entire canvas)",
        },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: ["width", "height", "direction"],
    },
  },
  {
    name: "save_theme_preset",
    description:
      "Save the themes and variables from an .op document as a reusable .optheme preset file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        presetPath: {
          type: "string",
          description: "Absolute path for the output .optheme file",
        },
        name: {
          type: "string",
          description: "Display name for the preset (defaults to file name)",
        },
      },
      required: ["presetPath"],
    },
  },
  {
    name: "load_theme_preset",
    description:
      "Load a .optheme preset file and merge its themes and variables into an .op document.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        presetPath: {
          type: "string",
          description: "Absolute path to the .optheme file to load",
        },
      },
      required: ["presetPath"],
    },
  },
  {
    name: "list_theme_presets",
    description: "List all .optheme preset files in a directory.",
    inputSchema: {
      type: "object" as const,
      properties: {
        directory: {
          type: "string",
          description: "Absolute path to the directory to scan",
        },
      },
      required: ["directory"],
    },
  },
  {
    name: "add_page",
    description:
      "Add a new page to an .op file. If the document has no pages yet, the existing children are migrated to the first page automatically.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        name: { type: "string", description: 'Page name (default: "Page N")' },
        children: {
          type: "array",
          description:
            "Initial child nodes for the page. Defaults to a single empty 1200×800 white frame.",
          items: { type: "object" },
        },
      },
      required: [],
    },
  },
  {
    name: "remove_page",
    description:
      "Remove a page from an .op file. Cannot remove the last remaining page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        pageId: { type: "string", description: "ID of the page to remove" },
      },
      required: ["pageId"],
    },
  },
  {
    name: "rename_page",
    description: "Rename a page in an .op file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        pageId: { type: "string", description: "ID of the page to rename" },
        name: { type: "string", description: "New page name" },
      },
      required: ["pageId", "name"],
    },
  },
  {
    name: "reorder_page",
    description: "Move a page to a new position (index) in an .op file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        pageId: { type: "string", description: "ID of the page to move" },
        index: {
          type: "number",
          description: "New zero-based index for the page",
        },
      },
      required: ["pageId", "index"],
    },
  },
  {
    name: "duplicate_page",
    description:
      "Duplicate a page (deep-clone with new IDs) and insert the copy right after the original.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        pageId: { type: "string", description: "ID of the page to duplicate" },
        name: {
          type: "string",
          description:
            'Name for the duplicated page (default: "original copy")',
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "get_design_prompt",
    description:
      'Get design knowledge prompt. Use "section" to retrieve a focused subset instead of the full prompt. ' +
      "Sections: schema (PenNode types), layout (flexbox rules), roles (semantic roles), text (typography/CJK/copywriting), " +
      "style (visual style policy), icons (icon names), examples (design examples), guidelines (design tips), planning (layered workflow guide). " +
      "Omit section for the full prompt.",
    inputSchema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          enum: [
            "all",
            "schema",
            "layout",
            "roles",
            "text",
            "style",
            "icons",
            "examples",
            "guidelines",
            "planning",
          ],
          description:
            'Which section of design knowledge to retrieve. Default: all. Use "planning" for layered generation workflow.',
        },
      },
      required: [],
    },
  },
  {
    name: "batch_design",
    description:
      "Execute batch design operations in a compact DSL. Each line is one operation:\n" +
      "  binding=I(parent, { ...nodeData })  — Insert node (binding captures new ID)\n" +
      "  U(path, { ...updates })             — Update node properties\n" +
      "  binding=C(sourceId, parent, { overrides })  — Copy node\n" +
      "  binding=R(path, { ...newNodeData }) — Replace node\n" +
      "  M(nodeId, parent, index?)           — Move node\n" +
      "  D(nodeId)                           — Delete node\n" +
      "Use null for root-level parent. Reference previous bindings by name. " +
      'Path expressions support binding+"/ childId" for nested access. ' +
      "Always set postProcess=true when generating designs for best visual quality.",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to .op file, or omit to use the live canvas (default)",
        },
        operations: {
          type: "string",
          description:
            'DSL operations, one per line. Example:\nroot=I(null, { "type": "frame", "name": "Page", "width": 1200, "height": 0, "layout": "vertical", "children": [...] })',
        },
        postProcess: {
          type: "boolean",
          description:
            "Apply post-processing (role defaults, icon resolution, layout sanitization). Always true for design generation.",
        },
        canvasWidth: {
          type: "number",
          description:
            "Canvas width for post-processing (default 1200, use 375 for mobile).",
        },
        pageId: {
          type: "string",
          description: "Target page ID (defaults to first page)",
        },
      },
      required: ["operations"],
    },
  },
  ...LAYERED_DESIGN_TOOLS,
];

// --- Game Theory Analyzer product tools ---

export const ANALYSIS_MODE_TOOL_DEFINITIONS = [
  {
    name: "get_entity",
    description: "Get a single analysis entity by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Entity ID to fetch" },
      },
      required: ["id"],
    },
  },
  {
    name: "query_entities",
    description:
      "Query analysis entities by phase, type, or stale status for read-only analysis.",
    inputSchema: {
      type: "object" as const,
      properties: {
        phase: {
          type: "string",
          description:
            "Filter by methodology phase (e.g. situational-grounding)",
        },
        type: {
          type: "string",
          description: "Filter by entity type (e.g. fact, player, objective)",
        },
        stale: {
          type: "boolean",
          description: "Filter by stale status",
        },
      },
      required: [],
    },
  },
  {
    name: "query_relationships",
    description:
      "Query analysis relationships by type or entity involvement for read-only analysis.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description:
            "Filter by relationship type (e.g. supports, contradicts, plays-in)",
        },
        entityId: {
          type: "string",
          description: "Filter to relationships involving this entity",
        },
      },
      required: [],
    },
  },
  {
    name: "request_loopback",
    description:
      "Record a methodology disruption trigger for orchestrator loopback handling.",
    inputSchema: {
      type: "object" as const,
      properties: {
        trigger_type: {
          type: "string",
          description: "Methodology disruption trigger type",
        },
        justification: {
          type: "string",
          description: "Why this trigger should cause a loopback",
        },
      },
      required: ["trigger_type", "justification"],
    },
  },
] as const;

export const CHAT_MODE_TOOL_DEFINITIONS = [
  ...ANALYSIS_MODE_TOOL_DEFINITIONS,
  {
    name: "start_analysis",
    description:
      "Start a new game-theoretic analysis of a real-world topic. Returns a run ID for tracking progress.",
    inputSchema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description: "The real-world topic to analyze",
        },
        provider: {
          type: "string",
          description:
            "AI provider to use for the analysis (e.g. anthropic, openai). Preserves provider affinity across phases.",
        },
        model: {
          type: "string",
          description:
            "Model ID to use for the analysis (e.g. claude-sonnet-4-20250514, gpt-4o). Preserves model affinity across phases.",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "get_analysis_status",
    description:
      "Get the current status of the active analysis or rerun job.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "create_entity",
    description: "Create a new analysis entity with AI provenance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description:
            "Entity type: fact, player, objective, game, strategy, payoff, institutional-rule, escalation-rung",
        },
        phase: {
          type: "string",
          description: "Methodology phase this entity belongs to",
        },
        data: {
          type: "object",
          description:
            "Entity-type-specific data (e.g. { type: 'fact', date, source, content, category })",
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Confidence level",
        },
        rationale: { type: "string", description: "Reasoning for this entity" },
        revision: {
          type: "number",
          description: "Revision number (default 1)",
        },
      },
      required: ["type", "phase", "data"],
    },
  },
  {
    name: "update_entity",
    description:
      "Update an existing analysis entity. Chains provenance with previousOrigin.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Entity ID to update" },
        updates: {
          type: "object",
          description: "Updated entity fields to merge into the existing entity",
        },
      },
      required: ["id", "updates"],
    },
  },
  {
    name: "delete_entity",
    description: "Delete an analysis entity by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Entity ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_relationship",
    description:
      "Create a relationship between two analysis entities. Both entity IDs must exist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description:
            "Relationship type: plays-in, has-objective, conflicts-with, has-strategy, supports, contradicts, produces, depends-on, invalidated-by, constrains, escalates-to, links, precedes, informed-by, derived-from",
        },
        fromId: { type: "string", description: "Source entity ID" },
        toId: { type: "string", description: "Target entity ID" },
        metadata: {
          type: "object",
          description: "Optional metadata for the relationship",
        },
      },
      required: ["type", "fromId", "toId"],
    },
  },
  {
    name: "delete_relationship",
    description: "Delete a relationship between two analysis entities by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Relationship ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "rerun_phases",
    description:
      "Trigger revalidation from the earliest specified methodology phase.",
    inputSchema: {
      type: "object" as const,
      properties: {
        phases: {
          type: "array",
          items: { type: "string" },
          description: "Methodology phases to rerun",
        },
      },
      required: ["phases"],
    },
  },
  {
    name: "abort_analysis",
    description: "Abort the currently running analysis job, if one exists.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
] as const;

const PRODUCT_TOOL_DEFINITIONS = CHAT_MODE_TOOL_DEFINITIONS;

// Merged set: OpenPencil tools + product tools (full profile), or product-only
const ALL_TOOL_DEFINITIONS = PRODUCT_ONLY
  ? PRODUCT_TOOL_DEFINITIONS
  : [...TOOL_DEFINITIONS, ...PRODUCT_TOOL_DEFINITIONS];

// --- Product tool handlers (exported for testing) ---

// Analysis tools (4)
export async function handleStartAnalysis(args: {
  topic: string;
  provider?: string;
  model?: string;
}): Promise<string> {
  // Provider/model affinity fallback: if the MCP caller (e.g. Claude adapter,
  // Codex adapter) didn't fill provider/model in the tool args, resolve them
  // from the app's current model selection. This ensures the analysis runs with
  // the same provider that initiated the call.
  let provider = args.provider;
  let model = args.model;

  if (!provider || !model) {
    try {
      // Dynamic import to avoid hard dependency from MCP server on UI stores.
      // In Electron shared-context this resolves synchronously from cache.
      const { useAIStore } = await import("@/stores/ai-store");
      const { useAgentSettingsStore } =
        await import("@/stores/agent-settings-store");
      const aiState = useAIStore.getState();
      const agentState = useAgentSettingsStore.getState();

      if (!model) {
        model = aiState.model || undefined;
      }

      if (!provider && model) {
        // Resolve provider from model groups
        const group = aiState.modelGroups.find((g) =>
          g.models.some((m) => m.value === model),
        );
        if (group) {
          provider = group.provider;
        } else {
          // Fallback: check which connected provider has this model
          for (const [pType, pConfig] of Object.entries(agentState.providers)) {
            if (
              pConfig.isConnected &&
              pConfig.models.some((m) => m.value === model)
            ) {
              provider = pType;
              break;
            }
          }
        }
      }
    } catch {
      // Store not available (e.g. standalone MCP server mode) — proceed without
    }
  }

  const { runId } = await analysisOrchestrator.runFull(
    args.topic,
    provider,
    model,
  );
  return JSON.stringify({ runId, status: "started", estimatedPhases: 3 });
}

function resolveToolRunId(): string | undefined {
  const envRunId = process.env.ANALYSIS_RUN_ID?.trim();
  if (envRunId) {
    return envRunId;
  }

  const activeAnalysis = analysisOrchestrator.getActiveStatus();
  if (activeAnalysis) {
    return activeAnalysis.runId;
  }

  const activeRevalidation = revalidationService.getActiveRevalStatus();
  return activeRevalidation?.runId;
}

function resolveEarliestRerunPhase(
  phases: string[],
): MethodologyPhase | { error: string } {
  if (phases.length === 0) {
    return { error: "rerun_phases requires at least one phase" };
  }

  const invalidPhases = phases.filter(
    (phase) => !(ALL_PHASES as readonly string[]).includes(phase),
  );
  if (invalidPhases.length > 0) {
    return {
      error: `Unsupported phases: ${invalidPhases.join(", ")}`,
    };
  }

  const unsupportedPhases = phases.filter(
    (phase) => !(V1_PHASES as readonly string[]).includes(phase),
  );
  if (unsupportedPhases.length > 0) {
    return {
      error:
        `rerun_phases currently supports only implemented phases: ${V1_PHASES.join(", ")}. ` +
        `Unsupported: ${unsupportedPhases.join(", ")}`,
    };
  }

  const earliestPhase = [...phases].sort(
    (left, right) => V1_PHASES.indexOf(left as MethodologyPhase) - V1_PHASES.indexOf(right as MethodologyPhase),
  )[0];

  return earliestPhase as MethodologyPhase;
}

export function handleGetAnalysisStatus(): string {
  const activeAnalysis = analysisOrchestrator.getActiveStatus();
  if (activeAnalysis) {
    return JSON.stringify(activeAnalysis);
  }

  const activeRevalidation = revalidationService.getActiveRevalStatus();
  if (activeRevalidation) {
    return JSON.stringify(activeRevalidation);
  }

  return JSON.stringify({ status: "idle" });
}

export function handleGetEntity(args: { id: string }): string {
  return JSON.stringify(getEntity(args.id));
}

export function handleQueryEntities(args: {
  phase?: string;
  type?: string;
  stale?: boolean;
}): string {
  return JSON.stringify(
    queryEntities({
      phase: args.phase,
      type: args.type,
      stale: args.stale,
    }),
  );
}

export function handleQueryRelationships(args: {
  type?: string;
  entityId?: string;
}): string {
  return JSON.stringify(
    queryRelationships({
      type: args.type,
      entityId: args.entityId,
    }),
  );
}

export function handleRequestLoopback(args: {
  trigger_type: string;
  justification: string;
}): string {
  return JSON.stringify(requestLoopback(args));
}

export function handleCreateEntity(args: {
  type: string;
  phase: string;
  data: Record<string, unknown>;
  confidence?: string;
  rationale?: string;
  revision?: number;
}): string {
  const runId = resolveToolRunId();
  const entity = createEntity(
    {
      type: args.type as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      phase: args.phase as MethodologyPhase,
      data: args.data as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      confidence: (args.confidence as any) ?? "medium", // eslint-disable-line @typescript-eslint/no-explicit-any
      rationale: args.rationale ?? "",
      revision: args.revision ?? 1,
      stale: false,
    },
    { source: "ai-edited", ...(runId ? { runId } : {}) },
  );
  return JSON.stringify({
    created: [entity],
    updated: [],
    staleMarked: [],
    grouped: [],
  });
}

export function handleUpdateEntity(args: {
  id: string;
  updates: Record<string, unknown>;
}): string {
  const runId = resolveToolRunId();

  // Capture stale IDs before the update so we can report newly stale entities.
  // updateEntity() in entity-graph-service now auto-propagates staleness to
  // downstream dependents, so we diff pre/post to find what was marked stale.
  const staleBefore = new Set(getStaleEntityIds());

  const result = updateEntity(args.id, args.updates as any, {
    source: "ai-edited",
    ...(runId ? { runId } : {}),
  }); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!result) {
    return JSON.stringify({ error: `Entity "${args.id}" not found` });
  }

  const staleAfter = getStaleEntityIds();
  const newlyStale = staleAfter.filter((sid) => !staleBefore.has(sid));

  return JSON.stringify({
    created: [],
    updated: [result],
    staleMarked: newlyStale,
    grouped: [],
  });
}

export function handleDeleteEntity(args: { id: string }): string {
  const deleted = removeEntity(args.id);
  if (!deleted) {
    return JSON.stringify({ error: `Entity "${args.id}" not found` });
  }

  return JSON.stringify({ deleted: true, id: args.id });
}

export function handleCreateRelationship(args: {
  type: string;
  fromId: string;
  toId: string;
  metadata?: Record<string, unknown>;
}): string {
  try {
    const result = createRelationship({
      type: args.type as RelationshipType,
      fromEntityId: args.fromId,
      toEntityId: args.toId,
      metadata: args.metadata,
    });
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function handleDeleteRelationship(args: { id: string }): string {
  const deleted = removeRelationship(args.id);
  if (!deleted) {
    return JSON.stringify({ error: `Relationship "${args.id}" not found` });
  }

  return JSON.stringify({ deleted: true, id: args.id });
}

export function handleRerunPhases(args: { phases: string[] }): string {
  const earliestPhase = resolveEarliestRerunPhase(args.phases);
  if (typeof earliestPhase !== "string") {
    return JSON.stringify(earliestPhase);
  }

  const { runId } = revalidationService.revalidate(undefined, earliestPhase);
  const status = revalidationService.getRevalStatus(runId);
  return JSON.stringify({
    runId,
    status: status?.status ?? "running",
    startPhase: earliestPhase,
  });
}

export function handleAbortAnalysis(): string {
  const activeStatus = analysisOrchestrator.getActiveStatus();
  if (!activeStatus) {
    return JSON.stringify({ aborted: false, status: "idle" });
  }

  analysisOrchestrator.abort();
  return JSON.stringify({ aborted: true, runId: activeStatus.runId });
}

// --- Tool execution handler ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP args are validated at runtime by the protocol
async function handleToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
) {
  // MCP protocol guarantees args match the inputSchema; cast via `unknown` to the handler's param type.
  const a = (args ?? {}) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (name) {
    case "open_document":
      return JSON.stringify(await handleOpenDocument(a), null, 2);
    case "batch_get":
      return JSON.stringify(await handleBatchGet(a), null, 2);
    case "get_selection":
      return JSON.stringify(await handleGetSelection(a), null, 2);
    case "insert_node":
      return JSON.stringify(await handleInsertNode(a), null, 2);
    case "update_node":
      return JSON.stringify(await handleUpdateNode(a), null, 2);
    case "delete_node":
      return JSON.stringify(await handleDeleteNode(a), null, 2);
    case "move_node":
      return JSON.stringify(await handleMoveNode(a), null, 2);
    case "copy_node":
      return JSON.stringify(await handleCopyNode(a), null, 2);
    case "replace_node":
      return JSON.stringify(await handleReplaceNode(a), null, 2);
    case "import_svg":
      return JSON.stringify(await handleImportSvg(a), null, 2);
    case "get_variables":
      return JSON.stringify(await handleGetVariables(a), null, 2);
    case "set_variables":
      return JSON.stringify(await handleSetVariables(a), null, 2);
    case "set_themes":
      return JSON.stringify(await handleSetThemes(a), null, 2);
    case "snapshot_layout":
      return JSON.stringify(await handleSnapshotLayout(a), null, 2);
    case "find_empty_space":
      return JSON.stringify(await handleFindEmptySpace(a), null, 2);
    case "save_theme_preset":
      return JSON.stringify(await handleSaveThemePreset(a), null, 2);
    case "load_theme_preset":
      return JSON.stringify(await handleLoadThemePreset(a), null, 2);
    case "list_theme_presets":
      return JSON.stringify(await handleListThemePresets(a), null, 2);
    case "add_page":
      return JSON.stringify(await handleAddPage(a), null, 2);
    case "remove_page":
      return JSON.stringify(await handleRemovePage(a), null, 2);
    case "rename_page":
      return JSON.stringify(await handleRenamePage(a), null, 2);
    case "reorder_page":
      return JSON.stringify(await handleReorderPage(a), null, 2);
    case "duplicate_page":
      return JSON.stringify(await handleDuplicatePage(a), null, 2);
    case "get_design_prompt":
      return JSON.stringify(
        {
          section: (a.section as string | undefined) ?? "all",
          availableSections: listPromptSections(),
          designPrompt: buildDesignPrompt(a.section as string | undefined),
        },
        null,
        2,
      );
    case "batch_design":
      return JSON.stringify(await handleBatchDesign(a), null, 2);
    case "design_skeleton":
      return JSON.stringify(await handleDesignSkeleton(a), null, 2);
    case "design_content":
      return JSON.stringify(await handleDesignContent(a), null, 2);
    case "design_refine":
      return JSON.stringify(await handleDesignRefine(a), null, 2);

    // Product tools
    case "start_analysis":
      return await handleStartAnalysis(a);
    case "get_analysis_status":
      return handleGetAnalysisStatus();
    case "get_entity":
      return handleGetEntity(a);
    case "query_entities":
      return handleQueryEntities(a);
    case "query_relationships":
      return handleQueryRelationships(a);
    case "request_loopback":
      return handleRequestLoopback(a);
    case "create_entity":
      return handleCreateEntity(a);
    case "update_entity":
      return handleUpdateEntity(a);
    case "delete_entity":
      return handleDeleteEntity(a);
    case "create_relationship":
      return handleCreateRelationship(a);
    case "delete_relationship":
      return handleDeleteRelationship(a);
    case "rerun_phases":
      return handleRerunPhases(a);
    case "abort_analysis":
      return handleAbortAnalysis();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function registerToolSet(server: Server, toolDefinitions: readonly ToolDefinition[]): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const text = await handleToolCall(name, args);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  });
}

/** Register tool handlers on a Server instance. */
function registerTools(server: Server): void {
  registerToolSet(server, ALL_TOOL_DEFINITIONS);
}

export function registerAnalysisTools(server: Server): void {
  registerToolSet(server, ANALYSIS_MODE_TOOL_DEFINITIONS);
}

export function registerChatTools(server: Server): void {
  registerToolSet(server, CHAT_MODE_TOOL_DEFINITIONS);
}

function createMcpServer(): Server {
  return new Server(
    { name: pkg.name, version: pkg.version },
    { capabilities: { tools: {} } },
  );
}

export function buildAnalysisMcpServer(): Server {
  const server = createMcpServer();
  registerAnalysisTools(server);
  return server;
}

export function buildChatMcpServer(): Server {
  const server = createMcpServer();
  registerChatTools(server);
  return server;
}

// --- HTTP server helper ---

function startHttpServer(port: number): void {
  // Per-session transport map: each client gets its own Server + Transport
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: Server }
  >();

  const httpServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, mcp-session-id",
    );
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found. Use /mcp endpoint." }));
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Route to existing session
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        await session.transport.handleRequest(req, res, body);
      } else {
        await session.transport.handleRequest(req, res);
      }
      return;
    }

    // New session — only POST (initialize) is valid without session ID
    if (req.method === "POST") {
      const mcpServer = createMcpServer();
      registerTools(mcpServer);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          sessions.set(sid, { transport, server: mcpServer });
        },
        onsessionclosed: (sid: string) => {
          sessions.delete(sid);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };

      await mcpServer.connect(transport);

      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      await transport.handleRequest(req, res, body);
      return;
    }

    // Invalid: GET/DELETE without valid session ID
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or missing session ID" },
        id: null,
      }),
    );
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.error(
      `Game Theory Analyzer MCP server listening on http://0.0.0.0:${port}/mcp`,
    );
  });
}

// --- Start ---

function parseArgs(): { stdio: boolean; http: boolean; port: number } {
  const args = process.argv.slice(2);
  const hasHttp = args.includes("--http");
  const hasStdio = args.includes("--stdio");
  const portIdx = args.indexOf("--port");
  const port =
    portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : MCP_DEFAULT_PORT;

  if (hasHttp && hasStdio)
    return {
      stdio: true,
      http: true,
      port: isNaN(port) ? MCP_DEFAULT_PORT : port,
    };
  if (hasHttp)
    return {
      stdio: false,
      http: true,
      port: isNaN(port) ? MCP_DEFAULT_PORT : port,
    };
  return { stdio: true, http: false, port: MCP_DEFAULT_PORT };
}

async function main() {
  const { stdio, http, port } = parseArgs();

  if (stdio && http) {
    // Both: stdio server + HTTP server (per-session)
    const stdioServer = createMcpServer();
    registerTools(stdioServer);
    await stdioServer.connect(new StdioServerTransport());

    startHttpServer(port);
  } else if (http) {
    startHttpServer(port);
  } else {
    const server = createMcpServer();
    registerTools(server);
    await server.connect(new StdioServerTransport());
  }
}

// Prevent uncaught errors from crashing the MCP server process
process.on("uncaughtException", (err) => {
  console.error("MCP server uncaught exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("MCP server unhandled rejection:", err);
});

// Only run main() when this file is the entrypoint (not when imported as a module).
// The Claude adapter imports handler functions from this file; running main()
// as a side effect would start the MCP CLI server unintentionally.
if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1])
) {
  main().catch((err) => {
    console.error("MCP server failed to start:", err);
    process.exit(1);
  });
}
