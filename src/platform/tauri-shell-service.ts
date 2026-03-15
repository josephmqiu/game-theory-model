import type { ShellService } from './types'

export class TauriShellService implements ShellService {
  setTitle(_title: string): void {
    throw new Error('TauriShellService.setTitle: not yet implemented')
  }

  onBeforeClose(_cb: () => Promise<boolean>): void {
    throw new Error('TauriShellService.onBeforeClose: not yet implemented')
  }
}
