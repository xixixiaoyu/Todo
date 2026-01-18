package main

import (
	"runtime"

	hook "github.com/robotn/gohook"
)

const (
	ShiftMask = 1
	CtrlMask  = 2
	AltMask   = 4
	MetaMask  = 8
)

// SetupGlobalShortcuts sets up the global shortcuts for the application
func (a *App) SetupGlobalShortcuts() {
	go func() {
		evChan := hook.Start()
		defer hook.End()

		for ev := range evChan {
			// 添加调试日志
			// fmt.Printf("Key Event: Kind=%d, Rawcode=%d, Keychar=%d, Mask=%d\n", ev.Kind, ev.Rawcode, ev.Keychar, ev.Mask)

			// Check for shortcuts based on platform
			if runtime.GOOS == "darwin" {
				// macOS: Option + Space
				// Option is AltKey (left or right)
				// macOS Space Rawcode is often 49
				isSpace := ev.Rawcode == 49 || ev.Keychar == ' '
				if ev.Kind == hook.KeyDown && (ev.Mask&AltMask != 0) && isSpace {
					a.ToggleWindow()
				}
			} else if runtime.GOOS == "windows" {
				// Windows: Alt + S or Alt + G
				// Alt is AltKey
				if ev.Kind == hook.KeyDown && (ev.Mask&AltMask != 0) {
					char := string(ev.Keychar)
					if char == "s" || char == "S" || char == "g" || char == "G" {
						a.ToggleWindow()
					}
				}
			}
		}
	}()
}
