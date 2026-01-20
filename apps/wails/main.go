package main

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
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
	appMenu := menu.NewMenu()
	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.AddText("Toggle Window", keys.CmdOrCtrl("k"), func(_ *menu.CallbackData) {
		app.ToggleWindow()
	})
	fileMenu.AddSeparator()
	fileMenu.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		app.Quit()
	})

	err = wails.Run(&options.App{
		Title:             "简思 (Lumina)",
		Menu:              appMenu,
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
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// 允许通过 /local-file/ 路径访问本地文件
				if strings.HasPrefix(r.URL.Path, "/local-file/") {
					path := strings.TrimPrefix(r.URL.Path, "/local-file/")
					// 解码路径（处理空格等字符）
					// 注意：生产环境应增加更严格的路径校验以防目录穿越攻击
					data, err := os.ReadFile(path)
					if err != nil {
						w.WriteHeader(http.StatusNotFound)
						return
					}
					w.Write(data)
					return
				}
				w.WriteHeader(http.StatusNotFound)
			}),
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
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			About: &mac.AboutInfo{
				Title:   "简思 (Lumina)",
				Message: "© 2024 Lumina Team",
			},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
