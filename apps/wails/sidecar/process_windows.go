//go:build windows

package sidecar

import (
	"fmt"
	"os/exec"
)

func setProcessGroupAttr(cmd *exec.Cmd) {
	// Windows does not support Setpgid; use CREATE_NEW_PROCESS_GROUP if needed.
	// For now, we rely on taskkill /T to terminate the process tree.
}

func killProcessUnix(pid int) error {
	// On Windows, killProcess dispatches to killProcessWindows directly.
	// This stub exists so process.go can reference the name unconditionally.
	return fmt.Errorf("killProcessUnix should not be called on Windows")
}
