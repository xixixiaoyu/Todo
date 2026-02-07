package main

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// ShowInfoDialog shows an information dialog
func (a *App) ShowInfoDialog(title, message string) {
	runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:    runtime.InfoDialog,
		Title:   title,
		Message: message,
	})
}

// ShowErrorDialog shows an error dialog
func (a *App) ShowErrorDialog(title, message string) {
	runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:    runtime.ErrorDialog,
		Title:   title,
		Message: message,
	})
}

// OpenBrowser opens the given URL in the system's default browser
func (a *App) OpenBrowser(url string) {
	runtime.BrowserOpenURL(a.ctx, url)
}

// Quit the application
func (a *App) Quit() {
	runtime.Quit(a.ctx)
}

// SetMiniMode toggles the mini mode for Pomodoro
func (a *App) SetMiniMode(enabled bool) {
	if enabled {
		width, height := 220, 180
		// Set to an ultra-compact mini size
		runtime.WindowSetSize(a.ctx, width, height)
		// Set always on top
		runtime.WindowSetAlwaysOnTop(a.ctx, true)

		// Snap to top-right corner with margin
		screens, _ := runtime.ScreenGetAll(a.ctx)
		if len(screens) > 0 {
			// Find primary screen
			var primary runtime.Screen
			for _, s := range screens {
				if s.IsPrimary {
					primary = s
					break
				}
			}
			if primary.Size.Width == 0 {
				primary = screens[0]
			}

			// Margin from top (considering macOS menu bar) and right
			marginRight := 20
			marginTop := 40
			runtime.WindowSetPosition(a.ctx, primary.Size.Width-width-marginRight, marginTop)
		}
	} else {
		// Restore to default size
		runtime.WindowSetSize(a.ctx, 1024, 768)
		// Disable always on top
		runtime.WindowSetAlwaysOnTop(a.ctx, false)
		// Center it
		runtime.WindowCenter(a.ctx)
	}
}

// ToggleWindow toggles the window visibility
func (a *App) ToggleWindow() {
	if runtime.WindowIsMinimised(a.ctx) {
		runtime.WindowUnminimise(a.ctx)
		runtime.WindowShow(a.ctx)
		runtime.WindowSetAlwaysOnTop(a.ctx, true)
		runtime.WindowSetAlwaysOnTop(a.ctx, false)
	} else {
		// If window is visible but not in focus, bring it to focus instead of minimising
		// This is a common pattern for "Spotlight" style apps
		runtime.WindowShow(a.ctx)
		runtime.WindowSetAlwaysOnTop(a.ctx, true)
		runtime.WindowSetAlwaysOnTop(a.ctx, false)

		// To truly toggle (minimise if already in focus), we'd need more state.
		// For now, let's focus on making sure it shows up.
	}
}

// ShowNotification shows a system notification
func (a *App) ShowNotification(title, message string) {
	runtime.EventsEmit(a.ctx, "notification", map[string]string{
		"title":   title,
		"message": message,
	})
}
