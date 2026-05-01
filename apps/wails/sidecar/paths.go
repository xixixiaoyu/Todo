package sidecar

import (
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
)

// SidecarConfig holds resolved paths for the Sidecar process.
type SidecarConfig struct {
	NodePath  string // Absolute path to the Node.js binary
	EntryPath string // Absolute path to the Sidecar JS entry point
}

// ResolveSidecarConfig resolves the Sidecar binary paths for the current OS.
// Returns an error if required files are not found.
func ResolveSidecarConfig() (SidecarConfig, error) {
	exeDir, err := executableDir()
	if err != nil {
		return SidecarConfig{}, err
	}

	nodePath, err := nodeBinaryPath(exeDir)
	if err != nil {
		return SidecarConfig{}, err
	}

	entryPath, err := sidecarEntryPath(exeDir)
	if err != nil {
		return SidecarConfig{}, err
	}

	// Verify files exist
	if _, err := os.Stat(nodePath); err != nil {
		slog.Warn("sidecar node binary not found", "path", nodePath, "error", err)
		return SidecarConfig{}, err
	}
	if _, err := os.Stat(entryPath); err != nil {
		slog.Warn("sidecar entry not found", "path", entryPath, "error", err)
		return SidecarConfig{}, err
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
