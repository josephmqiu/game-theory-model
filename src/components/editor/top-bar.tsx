import { useCallback, useEffect, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import {
  Plus,
  Sun,
  Moon,
  Maximize,
  Minimize,
  Blocks,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ClaudeLogo from '@/components/icons/claude-logo'
import OpenAILogo from '@/components/icons/openai-logo'
import OpenCodeLogo from '@/components/icons/opencode-logo'
import CopilotLogo from '@/components/icons/copilot-logo'
import LanguageSelector from '@/components/shared/language-selector'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { appStorage, initAppStorage } from '@/utils/app-storage'
import { useAgentSettingsStore } from '@/stores/agent-settings-store'
import { useAnalysisStore } from '@/stores/analysis-store'
import type { AIProviderType } from '@/types/agent-settings'

/** Convert a computed CSS color value (oklch/rgb/etc.) to #rrggbb via an offscreen canvas. */
function cssToHex(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = value
    const hex = ctx.fillStyle
    return hex.startsWith('#') ? hex : null
  } catch {
    return null
  }
}

const PROVIDER_ICONS: Record<AIProviderType, ComponentType<SVGProps<SVGSVGElement>>> = {
  anthropic: ClaudeLogo,
  openai: OpenAILogo,
  opencode: OpenCodeLogo,
  copilot: CopilotLogo,
}

const PROVIDER_ORDER: AIProviderType[] = [
  'anthropic',
  'openai',
  'opencode',
  'copilot',
]

function AgentStatusButton() {
  const { t } = useTranslation()
  const providers = useAgentSettingsStore((state) => state.providers)
  const mcpIntegrations = useAgentSettingsStore(
    (state) => state.mcpIntegrations,
  )
  const connectedTypes = PROVIDER_ORDER.filter(
    (providerType) => providers[providerType].isConnected,
  )
  const agentCount = connectedTypes.length
  const mcpCount = mcpIntegrations.filter((integration) => integration.enabled)
    .length
  const hasAny = agentCount > 0 || mcpCount > 0

  const tooltipParts: string[] = []
  if (agentCount > 0) {
    tooltipParts.push(`${agentCount} agent${agentCount === 1 ? '' : 's'}`)
  }
  if (mcpCount > 0) {
    tooltipParts.push(`${mcpCount} MCP`)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => useAgentSettingsStore.getState().setDialogOpen(true)}
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          {hasAny ? (
            <div className="flex items-center gap-1.5">
              {agentCount > 0 ? (
                <div className="flex items-center -space-x-1.5">
                  {connectedTypes.map((providerType) => {
                    const Icon = PROVIDER_ICONS[providerType]
                    return (
                      <div
                        key={providerType}
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground/10 ring-1 ring-card"
                      >
                        <Icon className="h-3 w-3" />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <Blocks size={14} strokeWidth={1.5} />
              )}
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {tooltipParts.join(' · ')}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Blocks size={14} strokeWidth={1.5} />
              <span className={cn('hidden text-[11px] sm:inline')}>
                {t('topbar.agentsAndMcp')}
              </span>
            </div>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {hasAny
          ? `${tooltipParts.join(' · ')} ${t('topbar.connected')}`
          : t('topbar.setupAgentsMcp')}
      </TooltipContent>
    </Tooltip>
  )
}

export default function TopBar() {
  const { t } = useTranslation()
  const analysis = useAnalysisStore((state) => state.analysis)
  const validation = useAnalysisStore((state) => state.validation)
  const newAnalysis = useAnalysisStore((state) => state.newAnalysis)

  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const syncOverlayColors = useCallback((nextTheme: 'dark' | 'light') => {
    if (!window.electronAPI?.setTheme) return

    requestAnimationFrame(() => {
      const styles = getComputedStyle(document.documentElement)
      const bg = cssToHex(styles.getPropertyValue('--card'))
      const fg = cssToHex(styles.getPropertyValue('--card-foreground'))
      window.electronAPI!.setTheme(
        nextTheme,
        bg && fg ? { bg, fg } : undefined,
      )
    })
  }, [])

  useEffect(() => {
    const restore = async () => {
      await initAppStorage()
      const savedTheme = appStorage.getItem('openpencil-theme')
      if (savedTheme === 'light') {
        document.documentElement.classList.add('light')
        setTheme('light')
        syncOverlayColors('light')
        return
      }

      syncOverlayColors('dark')
    }

    restore()
  }, [syncOverlayColors])

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'

    if (nextTheme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }

    setTheme(nextTheme)
    syncOverlayColors(nextTheme)
    appStorage.setItem('openpencil-theme', nextTheme)
  }, [theme, syncOverlayColors])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
      return
    }

    document.documentElement.requestFullscreen()
  }, [])

  const displayName = analysis.name.trim() || 'Untitled Analysis'
  const statusLabel = validation.isValid
    ? validation.isComplete
      ? 'Complete'
      : `${validation.incompleteProfiles.length} incomplete`
    : `${validation.issues.length} issue${validation.issues.length === 1 ? '' : 's'}`

  return (
    <div className="app-region-drag flex h-10 shrink-0 select-none items-center border-b border-border bg-card px-2">
      <div className="app-region-no-drag electron-traffic-light-pad flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="New analysis"
              onClick={newAnalysis}
              className="h-8"
            >
              <Plus size={16} strokeWidth={1.5} />
              New Analysis
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Start a fresh in-memory analysis
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-4">
        <span className="truncate text-xs text-foreground" suppressHydrationWarning>
          {displayName}
        </span>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          Session only
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            validation.isValid
              ? validation.isComplete
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="app-region-no-drag electron-win-controls-pad flex items-center gap-0.5">
        <AgentStatusButton />

        <div className="mx-1 h-3.5 w-px bg-border/60" />

        <LanguageSelector />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="text-muted-foreground"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? (
                <Sun size={15} strokeWidth={1.5} />
              ) : (
                <Moon size={15} strokeWidth={1.5} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {theme === 'dark' ? t('topbar.lightMode') : t('topbar.darkMode')}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="text-muted-foreground"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize size={15} strokeWidth={1.5} />
              ) : (
                <Maximize size={15} strokeWidth={1.5} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isFullscreen ? t('topbar.exitFullscreen') : t('topbar.fullscreen')}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
