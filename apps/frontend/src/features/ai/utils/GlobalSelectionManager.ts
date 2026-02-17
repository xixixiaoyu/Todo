export type SelectionCallback = (selection: Selection | null) => void
export type OutsideClickCallback = (event: MouseEvent) => void

interface Listeners {
  onSelectionChange: SelectionCallback
  onOutsideClick: OutsideClickCallback
}

export class GlobalSelectionManager {
  private static instance: GlobalSelectionManager
  private listeners = new Map<HTMLElement, Listeners>()
  private activeElement: HTMLElement | null = null
  private isListening = false

  static getInstance(): GlobalSelectionManager {
    if (!GlobalSelectionManager.instance) {
      GlobalSelectionManager.instance = new GlobalSelectionManager()
    }
    return GlobalSelectionManager.instance
  }

  register(element: HTMLElement, callbacks: Listeners) {
    this.listeners.set(element, callbacks)
    if (!this.isListening) {
      this.startListening()
    }
  }

  unregister(element: HTMLElement) {
    this.listeners.delete(element)
    if (this.listeners.size === 0) {
      this.stopListening()
    }
    if (this.activeElement === element) {
      this.activeElement = null
    }
  }

  private startListening() {
    document.addEventListener('selectionchange', this.handleSelectionChange)
    document.addEventListener('mousedown', this.handleMouseDown, true)
  }

  private stopListening() {
    document.removeEventListener('selectionchange', this.handleSelectionChange)
    document.removeEventListener('mousedown', this.handleMouseDown, true)
  }

  private handleSelectionChange = () => {
    const selection = window.getSelection()
    let targetElement: HTMLElement | null = null

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      let node: Node | null = range.commonAncestorContainer

      // Fix: commonAncestorContainer could be text node
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement
      }

      // Traverse up to find the registered element
      while (node) {
        if (node instanceof HTMLElement && this.listeners.has(node)) {
          targetElement = node
          break
        }
        node = node.parentNode
      }
    }

    // If active element changed, notify the old one (likely to clear selection state)
    if (this.activeElement && this.activeElement !== targetElement) {
      const callbacks = this.listeners.get(this.activeElement)
      if (callbacks) {
        callbacks.onSelectionChange(selection)
      }
    }

    // Notify the current target element (to update selection state/position)
    if (targetElement) {
      const callbacks = this.listeners.get(targetElement)
      if (callbacks) {
        callbacks.onSelectionChange(selection)
      }
    }

    this.activeElement = targetElement
  }

  private handleMouseDown = (event: MouseEvent) => {
    // Notify all listeners to handle outside click (e.g. close panel)
    for (const callbacks of this.listeners.values()) {
      callbacks.onOutsideClick(event)
    }
  }
}
