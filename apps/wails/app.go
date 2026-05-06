package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"strings"

	"lumina-wails/sidecar"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx     context.Context
	sidecar *sidecar.Manager
}

// NewApp creates a new App struct
func NewApp() *App {
	cfg, err := sidecar.ResolveSidecarConfig()
	if err != nil {
		// Sidecar is optional — log warning but don't fail
		slog.Warn("sidecar config resolution failed, sidecar disabled", "error", err)
		return &App{}
	}
	return &App{
		sidecar: sidecar.NewManager(cfg),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	if a.sidecar != nil {
		a.sidecar.SetEventEmitter(&sidecar.WailsEmitter{Ctx: ctx})
		// Start Sidecar asynchronously — don't block app startup
		go func() {
			if _, err := a.sidecar.Start(ctx); err != nil {
				slog.Error("sidecar failed to start", "error", err)
			}
		}()
	}
}

func (a *App) shutdown(_ context.Context) {
	if a.sidecar != nil {
		if err := a.sidecar.Stop(); err != nil {
			slog.Error("sidecar shutdown error", "error", err)
		}
	}
	a.ctx = nil
}

func (a *App) ready() bool {
	return a.ctx != nil
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// ShowInfoDialog shows an information dialog
func (a *App) ShowInfoDialog(title, message string) {
	if !a.ready() {
		return
	}
	runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:    runtime.InfoDialog,
		Title:   title,
		Message: message,
	})
}

// ShowErrorDialog shows an error dialog
func (a *App) ShowErrorDialog(title, message string) {
	if !a.ready() {
		return
	}
	runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:    runtime.ErrorDialog,
		Title:   title,
		Message: message,
	})
}

// OpenDirectoryDialog opens a native directory picker and returns the selected path
func (a *App) OpenDirectoryDialog(title string) string {
	if !a.ready() {
		return ""
	}
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
	if err != nil {
		return ""
	}
	return dir
}

// OpenBrowser opens the given URL in the system's default browser
func (a *App) OpenBrowser(rawURL string) {
	if !a.ready() {
		return
	}

	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme == "" {
		return
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" && scheme != "mailto" {
		return
	}

	runtime.BrowserOpenURL(a.ctx, rawURL)
}

// Quit the application
func (a *App) Quit() {
	if !a.ready() {
		return
	}
	runtime.Quit(a.ctx)
}

func selectPrimaryScreen(screens []runtime.Screen) (runtime.Screen, bool) {
	if len(screens) == 0 {
		return runtime.Screen{}, false
	}

	for _, s := range screens {
		if s.IsPrimary {
			return s, true
		}
	}

	return screens[0], true
}

func calcMiniModePosition(screen runtime.Screen, width int) (x int, y int) {
	marginRight := 20
	marginTop := 40
	return screen.Size.Width - width - marginRight, marginTop
}

// SetMiniMode toggles the mini mode for Pomodoro
func (a *App) SetMiniMode(enabled bool) {
	if !a.ready() {
		return
	}

	if enabled {
		width, height := 220, 180
		// Set to an ultra-compact mini size
		runtime.WindowSetSize(a.ctx, width, height)
		// Set always on top
		runtime.WindowSetAlwaysOnTop(a.ctx, true)

		// Snap to top-right corner with margin
		screens, _ := runtime.ScreenGetAll(a.ctx)
		primary, ok := selectPrimaryScreen(screens)
		if ok {
			x, y := calcMiniModePosition(primary, width)
			runtime.WindowSetPosition(a.ctx, x, y)
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
	if !a.ready() {
		return
	}

	if runtime.WindowIsMinimised(a.ctx) {
		runtime.WindowUnminimise(a.ctx)
		runtime.WindowShow(a.ctx)
		runtime.WindowSetAlwaysOnTop(a.ctx, true)
		runtime.WindowSetAlwaysOnTop(a.ctx, false)
	} else {
		runtime.WindowMinimise(a.ctx)
	}
}

// ShowNotification shows a system notification
func (a *App) ShowNotification(title, message string) {
	if !a.ready() {
		return
	}
	runtime.EventsEmit(a.ctx, "notification", map[string]string{
		"title":   title,
		"message": message,
	})
}

// GetSidecarInfo returns the current Sidecar state to the frontend.
func (a *App) GetSidecarInfo() *sidecar.SidecarInfo {
	if a.sidecar == nil {
		return &sidecar.SidecarInfo{Status: sidecar.StatusStopped}
	}
	return a.sidecar.Info()
}

// RestartSidecar restarts the Sidecar process.
func (a *App) RestartSidecar() error {
	if a.sidecar == nil {
		return fmt.Errorf("sidecar is not available")
	}
	return a.sidecar.Restart()
}
