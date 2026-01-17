package main

import (
	"embed"
	"io/fs"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Extract the actual assets from the embedded frontend/dist directory
	frontendAssets, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		println("Error extracting assets:", err.Error())
		return
	}

	// Create application with options
	err = wails.Run(&options.App{
		Title:             "Todo",
		Width:             1024,
		Height:            768,
		MinWidth:          800,
		MinHeight:         600,
		DisableResize:     false,
		Fullscreen:        false,
		Frameless:         false,
		StartHidden:       false,
		HideWindowOnClose: false,
		BackgroundColour:  &options.RGBA{R: 0, G: 0, B: 0, A: 0},
		AssetServer: &assetserver.Options{
			Assets: frontendAssets,
		},
		OnStartup: app.startup,
		Bind: []any{
			app,
		},
		// Windows specific options
		Windows: &windows.Options{
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			BackdropType:         windows.Mica,
			DisableWindowIcon:    false,
		},
		// macOS specific options
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarHiddenInset(),
			Appearance:           mac.NSAppearanceNameDefault,
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			About: &mac.AboutInfo{
				Title:   "Todo",
				Message: "© 2024 Todo Team",
			},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
