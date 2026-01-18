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
		// Set to mini size
		runtime.WindowSetSize(a.ctx, 280, 200)
		// Set always on top
		runtime.WindowSetAlwaysOnTop(a.ctx, true)
		// Move to a convenient place if needed, or let the user drag it
	} else {
		// Restore to default size
		runtime.WindowSetSize(a.ctx, 1024, 768)
		// Disable always on top
		runtime.WindowSetAlwaysOnTop(a.ctx, false)
		// Center it
		runtime.WindowCenter(a.ctx)
	}
}
