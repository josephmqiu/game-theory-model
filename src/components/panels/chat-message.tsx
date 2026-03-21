import { useState, type ReactNode } from 'react'
import { Copy, Check, Wand2, ChevronDown } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ChatAttachment } from '@/services/ai/ai-types'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  onApplyDesign?: (json: string) => void
  attachments?: ChatAttachment[]
}

/** Strip raw tool-call / function-call XML that should never be shown to users */
/** Strip raw tool-call / function-call XML that should never be shown to users */
function stripToolCallXml(text: string): string {
  let cleaned = text

  // Remove <function_calls> blocks
  cleaned = cleaned.replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
  
  // Remove <result> blocks (often tool outputs)
  cleaned = cleaned.replace(/<result>[\s\S]*?<\/result>/g, '')

  // Remove <inference_process> or similar internal blocks if they appear
  cleaned = cleaned.replace(/<inference_process>[\s\S]*?<\/inference_process>/g, '')

  // Remove <invoke> blocks (tool usage) - handle both closed and streaming/unclosed
  cleaned = cleaned.replace(/<invoke[\s\S]*?<\/invoke>/g, '')
  cleaned = cleaned.replace(/<invoke[\s\S]*?$/g, '') // Hide unclosed invoke at end of stream

  // Remove <parameter> blocks if they appear outside invoke for some reason
  cleaned = cleaned.replace(/<parameter[\s\S]*?<\/parameter>/g, '')

  // Remove stray tags
  cleaned = cleaned.replace(/<\/?invoke.*?>/g, '')
  cleaned = cleaned.replace(/<\/?parameter.*?>/g, '')
  cleaned = cleaned.replace(/<\/?function_calls>/g, '')
  cleaned = cleaned.replace(/<\/?search_quality_reflection>/g, '') // Sometimes this appears too
  cleaned = cleaned.replace(/<\/?thought_process>/g, '') // And this

  // Remove the hidden marker so it doesn't show up in UI even as whitespace
  cleaned = cleaned.replace(/<!-- APPLIED -->/g, '')
  
  // Collapse leftover blank lines into at most one
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  return cleaned.trim()
}

export interface ParsedStep {
  title: string
  content: string
  /** Explicit status from orchestrator steps (undefined for normal steps) */
  status?: 'pending' | 'streaming' | 'done' | 'error'
}

export function parseStepBlocks(text: string, isStreaming?: boolean): ParsedStep[] {
  const stepRegex = /<step([^>]*)>([\s\S]*?)<\/step>/gi
  const parsed: ParsedStep[] = []
  let match: RegExpExecArray | null

  while ((match = stepRegex.exec(text)) !== null) {
    const attrs = match[1]
    const titleMatch = attrs.match(/title="([^"]+)"/)
    const statusMatch = attrs.match(/status="([^"]+)"/)
    parsed.push({
      title: (titleMatch?.[1] ?? 'Processing').trim() || 'Processing',
      status: (statusMatch?.[1] as ParsedStep['status']) ?? undefined,
      content: (match[2] ?? '').trim(),
    })
  }

  const lastOpen = text.lastIndexOf('<step')
  const lastClose = text.lastIndexOf('</step>')
  if (isStreaming && lastOpen > lastClose) {
    const partial = text.slice(lastOpen)
    const titleMatch = partial.match(/title="([^"]+)"/i)
    const statusMatch = partial.match(/status="([^"]+)"/i)
    const contentStart = partial.indexOf('>')
    parsed.push({
      title: (titleMatch?.[1] ?? 'Response').trim() || 'Response',
      status: (statusMatch?.[1] as ParsedStep['status']) ?? undefined,
      content:
        contentStart >= 0
          ? partial
              .slice(contentStart + 1)
              .replace(/<\/step>$/i, '')
              .trim()
          : '',
    })
  }

  return parsed
}

function stripStepBlocks(text: string): string {
  return text
    .replace(/<step(?:[^>]*title="[^"]*")?[^>]*>[\s\S]*?<\/step>/gi, '')
    .replace(/<step(?:[^>]*title="[^"]*")?[^>]*>[\s\S]*$/gi, '')
    .trim()
}

/** Count completed sections in JSONL content (direct children of root frame). */
function countJsonlSections(content: string): number {
  const lines = content.split('\n')
  let rootId: string | null = null
  let sectionCount = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue

    const parentMatch = trimmed.match(/"_parent"\s*:\s*(null|"([^"]*)")/)
    if (!parentMatch) continue

    if (parentMatch[1] === 'null') {
      const idMatch = trimmed.match(/"id"\s*:\s*"([^"]*)"/)
      if (idMatch) rootId = idMatch[1]
    } else if (rootId && parentMatch[2] === rootId) {
      sectionCount++
    }
  }

  return sectionCount
}

export function countDesignJsonBlocks(text: string): number {
  const blockRegex = /```(?:json)?\s*\n?([\s\S]*?)(?:\n?```|$)/gi
  let count = 0
  let match: RegExpExecArray | null
  while ((match = blockRegex.exec(text)) !== null) {
    const content = match[1].trim()
    if (!isDesignJson(content)) continue

    // JSONL format: count direct children of root as sections
    if (/"_parent"\s*:/.test(content)) {
      count += countJsonlSections(content)
    } else {
      count += 1
    }
  }
  return count
}

export interface PipelineItem {
  label: string
  done: boolean
  active: boolean
  /** Optional detail lines (e.g. validation log) */
  details?: string[]
}

export function buildPipelineProgress(
  steps: ParsedStep[],
  jsonBlockCount: number,
  isStreaming: boolean,
  isApplied: boolean,
  hasError: boolean,
): PipelineItem[] {
  // No steps = no checklist
  if (steps.length === 0) return []

  // Parse detail lines from step content (one line per entry)
  function extractDetails(content: string): string[] | undefined {
    if (!content) return undefined
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
    return lines.length > 0 ? lines : undefined
  }

  // If steps have explicit status (orchestrator mode), use that directly.
  // Check this BEFORE terminal result logic so that user-stopped generations
  // preserve the actual per-step status instead of marking everything done.
  const hasExplicitStatus = steps.some((s) => s.status !== undefined)
  if (hasExplicitStatus) {
    return steps.map((s) => ({
      label: s.title,
      done: s.status === 'done',
      active: isStreaming && s.status === 'streaming',
      details: extractDetails(s.content),
    }))
  }

  // If generation is complete and applied, mark all steps done
  const hasTerminalResult = !isStreaming && !hasError && (isApplied || jsonBlockCount > 0)
  if (hasTerminalResult) {
    return steps.map((s) => ({ label: s.title, done: true, active: false, details: extractDetails(s.content) }))
  }

  // Fallback: Map each step to done/active/pending based on completed JSON blocks.
  // Step[i] is done when jsonBlockCount > i.
  // The step at jsonBlockCount is active (currently being generated).
  return steps.map((s, index) => {
    const done = index < jsonBlockCount
    const active = isStreaming && !done && index === jsonBlockCount
    return { label: s.title, done, active, details: extractDetails(s.content) }
  })
}

/** Component for rendering a list of action steps as accordions.
 *  Only shows steps with non-empty content (e.g. thinking, analysis).
 *  Empty plan steps are shown in PipelineChecklist instead. */
function ActionSteps({ steps, isStreaming }: { steps: ParsedStep[]; isStreaming?: boolean }) {
  // Filter to only show steps with actual content (not empty plan steps)
  const stepsWithContent = steps.filter((s) => s.content.trim())
  if (stepsWithContent.length === 0) return null

  return (
    <div className="flex flex-col gap-1 w-full">
      {stepsWithContent.map((step, i) => {
        const isDone = !isStreaming || i < stepsWithContent.length - 1
        const isActive = !!isStreaming && i === stepsWithContent.length - 1
        return (
          <ActionStepItem
            key={`${step.title}-${i}`}
            title={step.title}
            content={step.content}
            defaultOpen={isActive}
            isDone={isDone}
            isActive={isActive}
          />
        )
      })}
    </div>
  )
}

function ActionStepItem({
  title,
  content,
  defaultOpen = false,
  isDone,
  isActive,
}: {
  title: string
  content: string
  defaultOpen?: boolean
  isDone: boolean
  isActive: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between w-full px-3 py-2 text-left transition-all rounded-md border',
          isOpen
            ? 'bg-secondary/40 border-border/60'
            : 'bg-background/40 hover:bg-secondary/20 border-border/30 hover:border-border/50',
        )}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div
            className={cn(
              'w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors',
              isDone ? 'text-emerald-500/80' : isActive ? 'text-primary' : 'text-muted-foreground/50',
            )}
          >
            {isDone ? (
              <Check size={12} strokeWidth={2.5} />
            ) : (
              <div className={cn('w-2 h-2 rounded-full', isActive ? 'bg-primary animate-pulse' : 'bg-muted-foreground/60')} />
            )}
          </div>

          <span
            title={title}
            className={cn(
              'text-[11px] font-medium transition-colors truncate select-none',
              isDone ? 'text-muted-foreground/90' : isActive ? 'text-foreground' : 'text-muted-foreground/70',
            )}
          >
            {title}
          </span>
        </div>

        <div className="flex items-center text-muted-foreground/30">
          <ChevronDown size={12} className={cn('transition-transform duration-200', isOpen ? 'rotate-180' : '')} />
        </div>
      </button>

      {isOpen && content && (
        <div className="px-3 py-2 mx-1 mt-0.5 border-l border-border/30 text-[10px] text-muted-foreground/80 leading-relaxed font-mono animate-in slide-in-from-top-0.5 duration-200 whitespace-pre-wrap break-words">
          {content}
        </div>
      )}
    </div>
  )
}

/** Check if a JSON string looks like PenNode data */
function isDesignJson(code: string): boolean {
  return /^\s*[\[{]/.test(code) && /"type"\s*:/.test(code) && /"id"\s*:/.test(code)
}

function flashCopiedState(button: HTMLButtonElement) {
  button.dataset.copied = 'true'
  window.setTimeout(() => {
    button.dataset.copied = 'false'
  }, 2000)
}

type MarkdownSegment =
  | {
      type: 'markdown'
      content: string
    }
  | {
      type: 'code'
      code: string
      language: string
      isStreaming?: boolean
    }

function splitMarkdownSegments(text: string, isStreaming = false): MarkdownSegment[] {
  const segments: MarkdownSegment[] = []
  const markdownLines: string[] = []
  const lines = text.split('\n')
  let inCodeBlock = false
  let codeContent = ''
  let codeLang = ''
  let openingFence = ''

  const flushMarkdown = () => {
    const content = markdownLines.join('\n').trim()
    if (content) {
      segments.push({ type: 'markdown', content })
    }
    markdownLines.length = 0
  }

  for (const line of lines) {
    if (line.startsWith('```') && !inCodeBlock) {
      flushMarkdown()
      inCodeBlock = true
      openingFence = line
      codeLang = line.slice(3).trim()
      codeContent = ''
      continue
    }

    if (line.startsWith('```') && inCodeBlock) {
      inCodeBlock = false
      segments.push({
        type: 'code',
        code: codeContent.trimEnd(),
        language: codeLang,
      })
      openingFence = ''
      codeLang = ''
      codeContent = ''
      continue
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line
      continue
    }

    markdownLines.push(line)
  }

  if (inCodeBlock) {
    if (isStreaming && codeContent) {
      segments.push({
        type: 'code',
        code: codeContent.trimEnd(),
        language: codeLang,
        isStreaming: true,
      })
    } else {
      markdownLines.push(openingFence)
      if (codeContent) {
        markdownLines.push(codeContent)
      }
    }
  }

  flushMarkdown()
  return segments
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-lg font-semibold tracking-tight text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-base font-semibold tracking-tight text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold text-foreground first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 text-sm font-medium text-foreground first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="my-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="whitespace-pre-wrap break-words marker:text-muted-foreground">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border/70 pl-3 text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-0 border-t border-border/60" />,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-md border border-border/50">
      <table className="min-w-full border-collapse text-left text-xs text-foreground">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary/40">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border/40 last:border-b-0">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 font-medium text-foreground">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 align-top text-muted-foreground">{children}</td>,
  code: ({ children, className }) => (
    <code className={cn('rounded bg-secondary px-1 py-0.5 text-[0.85em] text-foreground/80', className)}>{children}</code>
  ),
}

function MarkdownBody({
  content,
  isStreaming,
}: {
  content: string
  isStreaming?: boolean
}) {
  return (
    <div className="min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
      {isStreaming ? (
        <span
          aria-label="streaming cursor"
          className="inline-block h-3.5 w-1.5 rounded-sm bg-muted-foreground/70 align-text-bottom animate-pulse"
        />
      ) : null}
    </div>
  )
}

function renderMarkdown(
  text: string,
  onApplyDesign?: (json: string) => void,
  isApplied?: boolean,
  isStreaming?: boolean,
): ReactNode[] {
  const segments = splitMarkdownSegments(text, isStreaming)

  return segments.map((segment, index) => {
    if (segment.type === 'code') {
      if (segment.language === 'json' && isDesignJson(segment.code)) {
        return (
          <DesignJsonBlock
            key={`design-${index}`}
            code={segment.code}
            onApply={onApplyDesign}
            isApplied={isApplied}
            isStreaming={segment.isStreaming}
          />
        )
      }

      return (
        <CodeBlock
          key={`code-${index}`}
          code={segment.code}
          language={segment.language}
        />
      )
    }

    return (
      <MarkdownBody
        key={`markdown-${index}`}
        content={segment.content}
        isStreaming={!!isStreaming && index === segments.length - 1}
      />
    )
  })
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const handleCopy = (button: HTMLButtonElement) => {
    navigator.clipboard.writeText(code)
    flashCopiedState(button)
  }

  return (
    <div className="my-2 rounded-md overflow-hidden bg-background border border-border">
      <div className="flex items-center justify-between px-3 py-1 bg-card border-b border-border">
        <span className="text-[10px] text-muted-foreground uppercase">{language || 'code'}</span>
        <button
          type="button"
          onClick={(event) => handleCopy(event.currentTarget)}
          className="group text-muted-foreground hover:text-foreground transition-colors p-0.5"
          data-copied="false"
          title="Copy code"
        >
          <Copy size={12} className="group-data-[copied=true]:hidden" />
          <Check size={12} className="hidden group-data-[copied=true]:block" />
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs leading-relaxed">
        <code className="text-foreground/80">{code}</code>
      </pre>
    </div>
  )
}

/** Collapsed design JSON block — shows element count + expand toggle */
function DesignJsonBlock({
  code,
  onApply,
  isApplied,
  isStreaming,
}: {
  code: string
  onApply?: (json: string) => void
  isApplied?: boolean
  isStreaming?: boolean
}) {
  const elementCount = (() => {
    try {
      const parsed = JSON.parse(code)
      if (Array.isArray(parsed)) return parsed.length
      return 1
    } catch {
      // JSONL format: count lines that look like JSON objects
      if (/"_parent"\s*:/.test(code)) {
        return code.split('\n').filter(line => line.trim().startsWith('{')).length
      }
      return 0
    }
  })()

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
  }

  return (
    <details className="group mt-0.5 w-full">
      <summary className="flex items-center justify-between w-full list-none px-3 py-2 text-left transition-all rounded-md border bg-background/40 hover:bg-secondary/20 border-border/30 hover:border-border/50 cursor-pointer group-open:bg-secondary/40 group-open:border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 rounded-full flex items-center justify-center bg-primary/10 text-primary shrink-0">
            <Wand2 size={10} />
          </div>
          <span
            className={cn(
              "text-[11px] font-medium tracking-tight",
              isStreaming ? "text-muted-foreground animate-pulse" : "text-foreground/90 group-hover:text-foreground",
            )}
          >
            {isStreaming
              ? 'Generating design...'
              : `${elementCount} design element${elementCount !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleCopy()
              flashCopiedState(e.currentTarget)
            }}
            className="group text-muted-foreground/30 hover:text-foreground transition-colors p-1 opacity-0 group-hover:opacity-100 mr-1"
            data-copied="false"
            title="Copy JSON"
          >
            <Copy size={10} className="group-data-[copied=true]:hidden" />
            <Check size={10} className="hidden group-data-[copied=true]:block" />
          </button>
          <ChevronDown size={12} className="text-muted-foreground/30 transition-transform duration-200 group-open:rotate-180" />
        </div>
      </summary>

      <div className="mt-1 rounded-md border border-border/30 overflow-hidden bg-card/50">
        <pre className="p-3 overflow-x-auto text-[9px] leading-relaxed max-h-48 overflow-y-auto font-mono text-muted-foreground/80">
          <code>{code}</code>
        </pre>

        {!isStreaming && onApply && !isApplied && (
          <div className="px-2 py-1.5 border-t border-border/30 bg-secondary/10">
            <Button
              onClick={() => onApply(code)}
              variant="ghost"
              className="w-full h-7 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5"
              size="sm"
            >
              Apply to Canvas
            </Button>
          </div>
        )}
      </div>
    </details>
  )
}

export default function ChatMessage({
  role,
  content,
  isStreaming,
  onApplyDesign,
  attachments,
}: ChatMessageProps) {
  const isUser = role === 'user'
  const isApplied = role === 'assistant' && (content.includes('\u2705') || content.includes('<!-- APPLIED -->'))
  // Strip raw tool-call XML that the model may emit (should never be visible)
  const displayContent = isUser ? content : stripToolCallXml(content)
  const steps = isUser ? [] : parseStepBlocks(displayContent, isStreaming)
  const hasFlow = !isUser && steps.length > 0
  const contentWithoutSteps = isUser ? displayContent : stripStepBlocks(displayContent)
  const isEmpty = !contentWithoutSteps.trim() && !hasFlow

  // Don't render an empty non-streaming assistant message
  // UNLESS we stripped something out (meaning the AI did something, but we hid it).
  // In that case, show a generic "Design generated" message or similar to avoid confusion?
  // Or better, if it's empty, it means we probably just suppressed a tool call.
  // Let's show a "Processing..." or "Action completed" placeholder if it's empty but had content.
  const hadContent = content.trim().length > 0
  if (!isUser && isEmpty && !isStreaming) {
     if (hadContent) {
       return (
         <div className="text-xs text-muted-foreground italic px-2 py-1">
           (Automated action completed)
         </div>
       )
     }
     return null
  }

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start mt-2')}>
      {isUser ? (
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-primary text-primary-foreground rounded-br-sm">
          {attachments && attachments.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {attachments.map((att) => (
                <img
                  key={att.id}
                  src={`data:${att.mediaType};base64,${att.data}`}
                  alt={att.name}
                  className="max-h-20 rounded object-cover"
                />
              ))}
            </div>
          )}
          {content}
        </div>
      ) : (
        <div className="text-sm leading-relaxed text-foreground min-w-0 w-full overflow-hidden">
          {/* Streaming with no content yet → thinking indicator */}
          {isEmpty && isStreaming ? (
            <div className="flex items-center gap-1.5 bg-secondary/50 rounded-full w-fit py-1 px-2.5 mt-2">
              <span className="text-xs text-muted-foreground">Thinking</span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          ) : (
            <>
              {hasFlow && (
                <div className="mb-2">
                  <ActionSteps steps={steps} isStreaming={isStreaming} />
                </div>
              )}
              {contentWithoutSteps.trim() ? (
                <div className="min-w-0">
                  {renderMarkdown(
                    contentWithoutSteps,
                    onApplyDesign,
                    isApplied,
                    isStreaming && !!contentWithoutSteps.trim(),
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  )
}
