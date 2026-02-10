package main

import (
	"testing"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func TestSelectPrimaryScreen(t *testing.T) {
	_, ok := selectPrimaryScreen(nil)
	if ok {
		t.Fatalf("expected ok=false")
	}

	s1 := runtime.Screen{IsPrimary: false}
	s1.Size.Width = 1200
	s2 := runtime.Screen{IsPrimary: true}
	s2.Size.Width = 1920

	primary, ok := selectPrimaryScreen([]runtime.Screen{s1, s2})
	if !ok {
		t.Fatalf("expected ok=true")
	}
	if !primary.IsPrimary {
		t.Fatalf("expected primary screen")
	}
}

func TestSelectPrimaryScreenFallsBackToFirst(t *testing.T) {
	s1 := runtime.Screen{IsPrimary: false}
	s1.Size.Width = 1200
	s2 := runtime.Screen{IsPrimary: false}
	s2.Size.Width = 1920

	primary, ok := selectPrimaryScreen([]runtime.Screen{s1, s2})
	if !ok {
		t.Fatalf("expected ok=true")
	}
	if primary.Size.Width != 1200 {
		t.Fatalf("expected fallback to first screen")
	}
}

func TestCalcMiniModePosition(t *testing.T) {
	s := runtime.Screen{IsPrimary: true}
	s.Size.Width = 1440
	x, y := calcMiniModePosition(s, 220)
	if x != 1200 {
		t.Fatalf("expected x=1200, got %d", x)
	}
	if y != 40 {
		t.Fatalf("expected y=40, got %d", y)
	}
}
