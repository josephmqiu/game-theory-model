import type { ShellService } from './types'

export class BrowserShellService implements ShellService {
  setTitle(title: string): void {
    document.title = title
  }

  onBeforeClose(_cb: () => Promise<boolean>): void {
    window.addEventListener('beforeunload', (event) => {
      event.preventDefault()
    })
  }
}
