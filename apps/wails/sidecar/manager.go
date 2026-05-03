package sidecar

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// SidecarStatus represents the lifecycle state of the Sidecar process.
type SidecarStatus string

const (
	StatusStopped  SidecarStatus = "stopped"
	StatusStarting SidecarStatus = "starting"
	StatusRunning  SidecarStatus = "running"
	StatusErrored  SidecarStatus = "errored"
)

// SidecarInfo is returned to the frontend to describe current Sidecar state.
type SidecarInfo struct {
	Status SidecarStatus `json:"status"`
	Port   int           `json:"port"`
	URL    string        `json:"url"`
	PID    int           `json:"pid"`
	Error  string        `json:"error"`
	// Token is a per-process Bearer credential the frontend MUST send on
	// every Sidecar HTTP request. Rotated on each Start/Restart.
	Token string `json:"token"`
}

// EventEmitter decouples the Manager from the Wails runtime for testability.
type EventEmitter interface {
	Emit(event string, data ...any)
}

// WailsEmitter adapts the Wails runtime to the EventEmitter interface.
type WailsEmitter struct {
	Ctx context.Context
}

func (e *WailsEmitter) Emit(event string, data ...any) {
	runtime.EventsEmit(e.Ctx, event, data...)
}

// Manager manages the Sidecar process lifecycle.
type Manager struct {
	mu      sync.RWMutex
	config  SidecarConfig
	cmd     *exec.Cmd
	status  SidecarStatus
	port    int
	pid     int
	token   string
	lastErr string
	ctx     context.Context
	wg      sync.WaitGroup

	restartAttempts int
	events          EventEmitter
}

// NewManager creates a new Sidecar process Manager with the given config.
func NewManager(cfg SidecarConfig) *Manager {
	return &Manager{
		config: cfg,
		status: StatusStopped,
	}
}

// SetEventEmitter sets the event emitter (called after Wails context is available).
func (m *Manager) SetEventEmitter(emitter EventEmitter) {
	m.events = emitter
}

// Start spawns the Sidecar process and waits for health check.
// Safe to call multiple times; returns current info if already running.
func (m *Manager) Start(ctx context.Context) (*SidecarInfo, error) {
	m.mu.Lock()
	if m.status == StatusRunning {
		info := m.info()
		m.mu.Unlock()
		return info, nil
	}

	m.status = StatusStarting
	m.lastErr = ""
	m.mu.Unlock()

	// Generate a fresh Bearer token for this process lifecycle.
	token, err := generateToken()
	if err != nil {
		m.setStatus(StatusErrored, fmt.Sprintf("token generation failed: %v", err))
		return m.Info(), err
	}

	// Allocate a port
	port, err := findAvailablePort()
	if err != nil {
		m.setStatus(StatusErrored, fmt.Sprintf("port allocation failed: %v", err))
		return m.Info(), err
	}

	// Spawn the Sidecar process
	cmd, actualPort, err := spawnProcess(ctx, m.config, port, token)
	if err != nil {
		m.setStatus(StatusErrored, fmt.Sprintf("process spawn failed: %v", err))
		return m.Info(), err
	}

	pid := cmd.Process.Pid
	baseURL := fmt.Sprintf("http://127.0.0.1:%d/sidecar", actualPort)

	m.mu.Lock()
	m.cmd = cmd
	m.port = actualPort
	m.pid = pid
	m.token = token
	m.ctx = ctx
	m.mu.Unlock()

	// Wait for health check
	healthCtx, healthCancel := context.WithTimeout(ctx, 15*time.Second)
	defer healthCancel()

	if err := waitForHealthy(healthCtx, baseURL, 500*time.Millisecond, 15*time.Second); err != nil {
		m.mu.Lock()
		m.status = StatusErrored
		m.lastErr = fmt.Sprintf("health check failed: %v", err)
		m.mu.Unlock()
		killProcess(pid)
		m.emit("sidecar:crashed", map[string]any{"error": m.lastErr, "attempt": 0})
		return m.Info(), err
	}

	m.mu.Lock()
	m.status = StatusRunning
	m.restartAttempts = 0 // 成功启动后重置计数器
	m.mu.Unlock()

	m.emit("sidecar:started", map[string]any{
		"port": m.port,
		"url":  m.baseURL(),
		"pid":  m.pid,
	})

	slog.Info("sidecar started", "port", m.port, "pid", m.pid)

	// Monitor process for unexpected exits
	m.wg.Add(1)
	go m.monitorProcess()

	return m.Info(), nil
}

// Stop gracefully shuts down the Sidecar process.
func (m *Manager) Stop() error {
	m.mu.Lock()
	if m.status == StatusStopped {
		m.mu.Unlock()
		return nil
	}

	pid := m.pid
	m.status = StatusStopped
	m.port = 0
	m.pid = 0
	m.token = ""
	m.cmd = nil
	m.mu.Unlock()

	err := killProcess(pid)
	m.emit("sidecar:stopped", map[string]any{})
	m.wg.Wait()

	return err
}

// Restart stops and starts the Sidecar process.
func (m *Manager) Restart() error {
	if err := m.Stop(); err != nil {
		return err
	}
	ctx := m.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	_, err := m.Start(ctx)
	return err
}

// Info returns the current Sidecar state snapshot.
func (m *Manager) Info() *SidecarInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.info()
}

func (m *Manager) info() *SidecarInfo {
	return &SidecarInfo{
		Status: m.status,
		Port:   m.port,
		URL:    m.baseURL(),
		PID:    m.pid,
		Error:  m.lastErr,
		Token:  m.token,
	}
}

func (m *Manager) baseURL() string {
	if m.port > 0 {
		return fmt.Sprintf("http://127.0.0.1:%d/sidecar", m.port)
	}
	return ""
}

func (m *Manager) setStatus(status SidecarStatus, errMsg string) {
	m.mu.Lock()
	m.status = status
	m.lastErr = errMsg
	m.mu.Unlock()
}

func (m *Manager) emit(event string, data any) {
	if m.events != nil {
		m.events.Emit(event, data)
	}
}

// monitorProcess watches for unexpected process exits and attempts restart.
func (m *Manager) monitorProcess() {
	defer m.wg.Done()

	m.mu.RLock()
	cmd := m.cmd
	m.mu.RUnlock()

	if cmd == nil {
		return
	}

	// Block until the process exits
	_ = cmd.Wait()

	m.mu.RLock()
	wasRunning := m.status == StatusRunning
	m.mu.RUnlock()

	if !wasRunning {
		return // Intentional stop
	}

	// Unexpected exit — attempt restart with exponential backoff
	slog.Error("sidecar process exited unexpectedly")

	m.mu.Lock()
	m.status = StatusErrored
	m.lastErr = "process exited unexpectedly"
	m.restartAttempts++
	attempt := m.restartAttempts
	m.mu.Unlock()

	m.emit("sidecar:crashed", map[string]any{
		"error":   m.lastErr,
		"attempt": attempt,
	})

	// Exponential backoff: 1s → 2s → 4s → 8s → 16s (cap), max 5 attempts
	if attempt > 5 {
		slog.Error("sidecar max restart attempts reached", "attempts", attempt)
		return
	}

	backoff := time.Duration(1<<(attempt-1)) * time.Second
	if backoff > 16*time.Second {
		backoff = 16 * time.Second
	}

	time.Sleep(backoff)

	ctx := m.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	if _, err := m.Start(ctx); err != nil {
		slog.Error("sidecar restart failed", "attempt", attempt, "error", err)
	} else {
		m.mu.Lock()
		m.restartAttempts = 0
		m.mu.Unlock()
		m.emit("sidecar:restarted", map[string]any{
			"port": m.port,
			"url":  m.baseURL(),
			"pid":  m.pid,
		})
	}
}
