import type { McpServerLike } from './context'

export function registerPrompts(server: McpServerLike): void {
  server.registerPrompt({
    name: 'full_analysis',
    description: 'Run the complete 10-phase game theory analysis pipeline on a strategic situation.',
    arguments: [
      { name: 'situation', description: 'The strategic situation to analyze', required: true },
    ],
    render(args) {
      return `Analyze this strategic situation with the game-theory-analysis MCP tools. Start with Phase 1 grounding and proceed sequentially while stopping for proposal review as needed.\n\nSituation: ${args.situation}`
    },
  })

  server.registerPrompt({
    name: 'focused_analysis',
    description: 'Run a focused subset of the analysis pipeline.',
    arguments: [
      { name: 'situation', description: 'The strategic situation', required: true },
      { name: 'phases', description: 'Comma-separated phase numbers to run', required: true },
    ],
    render(args) {
      return `Analyze this strategic situation using the specified phases only.\n\nSituation: ${args.situation}\nPhases: ${args.phases}`
    },
  })
}
