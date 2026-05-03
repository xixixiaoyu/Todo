package sidecar

import (
	"encoding/base64"
	"testing"
)

func TestGenerateTokenLength(t *testing.T) {
	token, err := generateToken()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 32 bytes -> 43 chars when base64url encoded without padding.
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		t.Fatalf("token is not valid base64url: %v", err)
	}
	if len(decoded) != tokenEntropyBytes {
		t.Fatalf("expected %d bytes of entropy, got %d", tokenEntropyBytes, len(decoded))
	}
}

func TestGenerateTokenUniqueness(t *testing.T) {
	seen := make(map[string]struct{}, 128)
	for i := 0; i < 128; i++ {
		token, err := generateToken()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, dup := seen[token]; dup {
			t.Fatalf("duplicate token generated on iteration %d", i)
		}
		seen[token] = struct{}{}
	}
}
