package sidecar

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"
)

// waitForHealthy polls the Sidecar's /health endpoint until it responds
// or the timeout is reached.
func waitForHealthy(ctx context.Context, baseURL string, interval, timeout time.Duration) error {
	if interval <= 0 {
		interval = 500 * time.Millisecond
	}
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: 2 * time.Second}

	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("sidecar health check timed out after %v", timeout)
		}

		if ctx.Err() != nil {
			return ctx.Err()
		}

		if err := checkHealth(client, baseURL); err == nil {
			return nil
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(interval):
			// Continue polling
		}
	}
}

// checkHealth makes a single GET request to the Sidecar's /health endpoint.
func checkHealth(client *http.Client, baseURL string) error {
	url := baseURL + "/health"
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("sidecar health check returned status %d", resp.StatusCode)
	}

	return nil
}

// findAvailablePort binds to port 0 on 127.0.0.1 and returns the allocated port.
func findAvailablePort() (int, error) {
	addr, err := net.ResolveTCPAddr("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}

	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 0, err
	}
	defer l.Close()

	return l.Addr().(*net.TCPAddr).Port, nil
}
