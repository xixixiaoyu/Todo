package sidecar

import (
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// SidecarConfig holds resolved paths for the Sidecar process.
type SidecarConfig struct {
	NodePath  string // Absolute path to the Node.js binary
	EntryPath string // Absolute path to the Sidecar JS entry point
}

// ResolveSidecarConfig resolves the Sidecar binary paths for the current OS.
// In production: uses the bundled Node binary next to the executable.
// In dev mode: falls back to system "node" from PATH and the sidecar dist/ dir.
func ResolveSidecarConfig() (SidecarConfig, error) {
	exeDir, err := executableDir()
	if err != nil {
		return SidecarConfig{}, err
	}

	bundledNodePath, _ := nodeBinaryPath(exeDir)
	entryPath, err := sidecarEntryPath(exeDir)
	if err != nil {
		return SidecarConfig{}, err
	}

	// Try bundled Node first (production path)
	nodePath := bundledNodePath
	if _, err := os.Stat(nodePath); err != nil {
		// Bundled Node not found — fall back to system node (dev mode)
		slog.Info("sidecar bundled node not found, falling back to system node", "bundled", nodePath)
		systemNode, lookupErr := exec.LookPath("node")
		if lookupErr != nil {
			slog.Warn("sidecar node binary not found (neither bundled nor system)", "error", lookupErr)
			return SidecarConfig{}, lookupErr
		}
		nodePath = systemNode
	}

	// Try bundled entry first, then fall back to the sidecar dist directory
	if _, statErr := os.Stat(entryPath); statErr != nil {
		slog.Info("sidecar bundled entry not found, trying dist fallback", "bundled", entryPath)
		// In dev mode (wails dev), the CWD is apps/wails, sidecar dist is at ../sidecar/dist/sidecar.mjs
		cwd, _ := os.Getwd()
		distEntry := filepath.Join(cwd, "..", "sidecar", "dist", "sidecar.mjs")
		if _, distErr := os.Stat(distEntry); distErr == nil {
			entryPath = distEntry
			slog.Info("sidecar using dist entry", "path", entryPath)
		} else {
			slog.Warn("sidecar entry not found", "bundled", entryPath, "dist", distEntry, "error", statErr)
			return SidecarConfig{}, statErr
		}
	}

	return SidecarConfig{
		NodePath:  nodePath,
		EntryPath: entryPath,
	}, nil
}

// executableDir returns the directory containing the running executable.
func executableDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(exe)
	if err != nil {
		return "", err
	}
	return filepath.Dir(resolved), nil
}

// nodeBinaryPath returns the expected path to the Node.js binary.
func nodeBinaryPath(exeDir string) (string, error) {
	base := sidecarBaseDir(exeDir)

	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(base, "node", "bin", "node"), nil
	case "windows":
		return filepath.Join(base, "node", "node.exe"), nil
	default: // linux and others
		return filepath.Join(base, "node", "bin", "node"), nil
	}
}

// sidecarEntryPath returns the expected path to the Sidecar JS entry point.
func sidecarEntryPath(exeDir string) (string, error) {
	base := sidecarBaseDir(exeDir)
	return filepath.Join(base, "app", "sidecar.mjs"), nil
}

// sidecarBaseDir returns the root directory of the sidecar bundle.
// On macOS when running from a .app bundle, this is Contents/Resources/sidecar/.
// On other platforms, it's a sidecar/ directory next to the executable.
func sidecarBaseDir(exeDir string) string {
	// Detect macOS .app bundle: exeDir ends with Contents/MacOS
	if runtime.GOOS == "darwin" && filepath.Base(exeDir) == "MacOS" {
		parent := filepath.Dir(exeDir) // Contents
		if filepath.Base(parent) == "Contents" {
			return filepath.Join(parent, "Resources", "sidecar")
		}
	}

	return filepath.Join(exeDir, "sidecar")
}
