import type { ShellService } from './types'

export class BrowserShellService implements ShellService {
  setTitle(title: string): void {
    document.title = title
  }

  onBeforeClose(cb: () => Promise<boolean>): void {
    window.addEventListener('beforeunload', (event) => {
      cb().then((shouldBlock) => {
        if (shouldBlock) {
          event.preventDefault()
        }
      })
    })
  }
}
