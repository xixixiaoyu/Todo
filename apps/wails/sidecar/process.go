package sidecar

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// spawnProcess starts the Sidecar Node.js process.
// It returns the running exec.Cmd and the extracted port from stdout.
// The authToken is injected via SIDECAR_AUTH_TOKEN env var; empty token aborts startup.
func spawnProcess(ctx context.Context, cfg SidecarConfig, port int, authToken string) (*exec.Cmd, int, error) {
	if authToken == "" {
		return nil, 0, fmt.Errorf("sidecar auth token is required")
	}

	args := []string{cfg.EntryPath, "--port", fmt.Sprintf("%d", port)}

	cmd := exec.CommandContext(ctx, cfg.NodePath, args...)

	// Process group isolation — ensures child processes are terminated together
	setProcessGroupAttr(cmd)

	// Capture stdout to parse the sidecar:ready JSON
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	// Redirect stderr to parent stderr for logging
	cmd.Stderr = os.Stderr

	// Minimal environment; SIDECAR_AUTH_TOKEN is injected for Bearer auth.
	cmd.Env = []string{
		"PATH=" + os.Getenv("PATH"),
		"HOME=" + os.Getenv("HOME"),
		"USER=" + os.Getenv("USER"),
		"NODE_ENV=production",
		fmt.Sprintf("SIDECAR_PORT=%d", port),
		"SIDECAR_AUTH_TOKEN=" + authToken,
	}

	if err := cmd.Start(); err != nil {
		return nil, 0, fmt.Errorf("failed to start sidecar process: %w", err)
	}

	// Parse the sidecar:ready JSON from stdout to get the actual port
	actualPort := port
	readyCh := make(chan int, 1)
	go func() {
		defer close(readyCh)
		buf := make([]byte, 1024)
		n, err := stdout.Read(buf)
		if err != nil {
			slog.Error("sidecar stdout read error", "error", err)
			return
		}
		// Parse {"type":"sidecar:ready","port":NNNNN}
		parsed, err := parseReadyMessage(buf[:n])
		if err != nil {
			slog.Error("sidecar ready message parse error", "error", err)
			return
		}
		readyCh <- parsed
	}()

	select {
	case p := <-readyCh:
		if p > 0 {
			actualPort = p
		}
	case <-time.After(5 * time.Second):
		// If we don't get the ready message in 5s, use the assigned port
		slog.Warn("sidecar did not emit ready message, using assigned port")
	}

	return cmd, actualPort, nil
}

// killProcess terminates a process by PID with graceful fallback.
// Unix: SIGTERM → 5s → SIGKILL
// Windows: taskkill /PID <pid> /T /F
func killProcess(pid int) error {
	if pid <= 0 {
		return nil
	}

	if runtime.GOOS == "windows" {
		return killProcessWindows(pid)
	}
	return killProcessUnix(pid)
}

func killProcessWindows(pid int) error {
	cmd := exec.Command("taskkill", "/PID", fmt.Sprintf("%d", pid), "/T", "/F")
	return cmd.Run()
}

// parseReadyMessage parses the {"type":"sidecar:ready","port":NNNNN} JSON from stdout.
func parseReadyMessage(data []byte) (int, error) {
	line := strings.TrimSpace(string(data))
	var msg struct {
		Type string `json:"type"`
		Port int    `json:"port"`
	}
	if err := json.Unmarshal([]byte(line), &msg); err != nil {
		return 0, fmt.Errorf("invalid ready message: %w", err)
	}
	if msg.Type != "sidecar:ready" {
		return 0, fmt.Errorf("unexpected message type: %s", msg.Type)
	}
	return msg.Port, nil
}
