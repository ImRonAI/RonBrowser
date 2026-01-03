/**
 * Browser Service - Manages BrowserView for web page rendering
 * Handles URL normalization, navigation, and view bounds management
 */

import { BrowserView } from 'electron'

export class BrowserService {
  private static instance: BrowserService
  private browserView: BrowserView | null = null
  private mainWindow: Electron.BrowserWindow | null = null
  private currentUrl: string = 'ron://home'
  private viewOffsetY = 120 // Height of toolbar + tab bar

  private constructor() {}

  public static getInstance(): BrowserService {
    if (!BrowserService.instance) {
      BrowserService.instance = new BrowserService()
    }
    return BrowserService.instance
  }

  /**
   * Initialize the BrowserView and attach to main window
   */
  public initialize(mainWindow: Electron.BrowserWindow): void {
    this.mainWindow = mainWindow

    if (!this.browserView) {
      this.browserView = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        }
      })

      mainWindow.addBrowserView(this.browserView)

      // Set initial bounds (below toolbar)
      this.updateBounds()

      // Update bounds when window resizes
      mainWindow.on('resize', () => {
        this.updateBounds()
      })

      // Load initial home page
      this.navigate('ron://home')

      // Track navigation events
      this.browserView.webContents.on('did-start-loading', () => {
        console.log('[BrowserService] Started loading:', this.currentUrl)
      })

      this.browserView.webContents.on('did-stop-loading', () => {
        console.log('[BrowserService] Finished loading:', this.currentUrl)
        mainWindow.webContents.send('browser:navigation-complete', this.currentUrl)
      })

      this.browserView.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error('[BrowserService] Failed to load:', errorCode, errorDescription, validatedURL)
        mainWindow.webContents.send('browser:navigation-error', {
          errorCode,
          errorDescription,
          url: validatedURL,
        })
      })
    }
  }

  /**
   * Update BrowserView bounds based on window size
   */
  private updateBounds(): void {
    if (!this.mainWindow || !this.browserView) return

    const [width, height] = this.mainWindow.getContentSize()
    
    this.browserView.setBounds({
      x: 0,
      y: this.viewOffsetY,
      width: width,
      height: height - this.viewOffsetY
    })
  }

  /**
   * Normalize a URL input into a proper URL
   * - Adds https:// to domains
   * - Converts search queries to Brave search URLs
   * - Preserves ron:// protocol
   */
  public normalizeUrl(input: string): string {
    const trimmed = input.trim()
    
    // Empty input
    if (!trimmed) {
      return this.currentUrl
    }
    
    // If it's already a valid URL, return it
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://')) {
      return trimmed
    }
    
    // Handle ron:// protocol
    if (trimmed.startsWith('ron://')) {
      return trimmed
    }
    
    // Handle search queries (spaces in input = search query)
    if (trimmed.includes(' ') || !trimmed.includes('.')) {
      // Search query - use Brave search
      const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(trimmed)}`
      console.log('[BrowserService] Converting to search:', searchUrl)
      return searchUrl
    }
    
    // Likely a domain - add https://
    const url = `https://${trimmed}`
    console.log('[BrowserService] Converting to URL:', url)
    return url
  }

  /**
   * Navigate to a URL
   */
  public navigate(url: string): void {
    if (!this.browserView) {
      console.error('[BrowserService] BrowserView not initialized')
      return
    }

    const normalizedUrl = this.normalizeUrl(url)
    console.log('[BrowserService] Navigating to:', normalizedUrl)
    
    this.currentUrl = normalizedUrl
    this.browserView.webContents.loadURL(normalizedUrl)
  }

  /**
   * Navigate to search results page
   */
  public search(query: string): void {
    if (!query.trim()) return
    
    const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query.trim())}`
    console.log('[BrowserService] Searching:', searchUrl)
    
    this.currentUrl = searchUrl
    this.browserView?.webContents.loadURL(searchUrl)
  }

  /**
   * Navigate backward
   */
  public goBack(): void {
    if (this.browserView?.webContents.canGoBack()) {
      this.browserView.webContents.goBack()
    }
  }

  /**
   * Navigate forward
   */
  public goForward(): void {
    if (this.browserView?.webContents.canGoForward()) {
      this.browserView.webContents.goForward()
    }
  }

  /**
   * Reload current page
   */
  public reload(): void {
    this.browserView?.webContents.reload()
  }

  /**
   * Get current URL
   */
  public getCurrentUrl(): string {
    return this.currentUrl
  }

  /**
   * Get BrowserView instance
   */
  public getBrowserView(): BrowserView | null {
    return this.browserView
  }

  /**
   * Get web contents
   */
  public getWebContents(): Electron.WebContents | null {
    return this.browserView?.webContents || null
  }

  /**
   * Check if can go back
   */
  public canGoBack(): boolean {
    return this.browserView?.webContents.canGoBack() || false
  }

  /**
   * Check if can go forward
   */
  public canGoForward(): boolean {
    return this.browserView?.webContents.canGoForward() || false
  }
}
