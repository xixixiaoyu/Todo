package sidecar

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

// tokenEntropyBytes is the byte length of the random token payload.
// 32 bytes = 256 bits of entropy, encoded to ~43 base64url chars.
const tokenEntropyBytes = 32

// generateToken returns a cryptographically random URL-safe token.
// The token is used for Bearer authentication between the Wails host and the
// Sidecar HTTP server; a fresh token is generated on every process start.
func generateToken() (string, error) {
	buf := make([]byte, tokenEntropyBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("failed to generate sidecar auth token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
