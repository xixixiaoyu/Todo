package main

import (
	"runtime"

	"golang.design/x/hotkey"
	"golang.design/x/hotkey/mainthread"
)

// SetupGlobalShortcuts sets up the global shortcuts for the application using native APIs
func (a *App) SetupGlobalShortcuts() {
	// hotkey library requires mainthread locking for macOS Carbon API
	go mainthread.Init(func() {
		if runtime.GOOS == "darwin" {
			// macOS: Option + Space
			a.registerHotkey(hotkey.ModOption, hotkey.KeySpace)
		} else if runtime.GOOS == "windows" {
			// Windows uses different modifiers and keycodes
			// Alt is 0x1, S is 0x53, G is 0x47 in Windows Virtual Keys
			a.registerHotkey(hotkey.Modifier(0x1), hotkey.Key(0x53)) // Alt + S
			a.registerHotkey(hotkey.Modifier(0x1), hotkey.Key(0x47)) // Alt + G
		}
	})
}

func (a *App) registerHotkey(mod hotkey.Modifier, key hotkey.Key) {
	hk := hotkey.New([]hotkey.Modifier{mod}, key)
	if err := hk.Register(); err != nil {
		println("Failed to register hotkey:", err.Error())
		return
	}

	go func() {
		for range hk.Keydown() {
			a.ToggleWindow()
		}
	}()
}
