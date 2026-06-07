//go:build !windows

package sidecar

import (
	"fmt"
	"os/exec"
	"syscall"
	"time"
)

func setProcessGroupAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func killProcessUnix(pid int) error {
	// Send SIGTERM to the process group
	pgid, err := syscall.Getpgid(pid)
	if err != nil {
		// Fallback to signaling the process directly
		if err := syscall.Kill(pid, syscall.SIGTERM); err != nil {
			return fmt.Errorf("failed to send SIGTERM to sidecar: %w", err)
		}
	} else {
		if err := syscall.Kill(-pgid, syscall.SIGTERM); err != nil {
			// Process may already be dead
			if err != syscall.ESRCH {
				return fmt.Errorf("failed to send SIGTERM to sidecar group: %w", err)
			}
		}
	}

	// Wait up to 5s for graceful shutdown
	done := make(chan bool)
	go func() {
		// Poll for process exit
		for i := 0; i < 50; i++ {
			if err := syscall.Kill(pid, 0); err == syscall.ESRCH {
				done <- true
				return
			}
			time.Sleep(100 * time.Millisecond)
		}
		done <- false
	}()

	graceful := <-done
	if graceful {
		return nil
	}

	// Force kill
	pgid, err = syscall.Getpgid(pid)
	if err != nil {
		syscall.Kill(pid, syscall.SIGKILL)
	} else {
		syscall.Kill(-pgid, syscall.SIGKILL)
	}

	return nil
}
