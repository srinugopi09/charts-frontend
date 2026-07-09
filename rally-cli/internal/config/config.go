// Package config loads and saves the CLI's tiny JSON config file and applies
// environment-variable overrides. Precedence (highest first): CLI flag
// (applied by the cli package) > env var > config file > built-in default.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Keys accepted by `rally config set`.
var Keys = []string{"api_key", "base_url", "workspace", "project"}

type Config struct {
	APIKey    string `json:"api_key,omitempty"`
	BaseURL   string `json:"base_url,omitempty"`
	Workspace string `json:"workspace,omitempty"`
	Project   string `json:"project,omitempty"`

	// Basic-auth fallback; env-only, never stored in the file.
	Username string `json:"-"`
	Password string `json:"-"`

	// Sources records where each effective value came from, for
	// `rally config list` and auth diagnostics.
	Sources map[string]string `json:"-"`
}

// Path returns the config file location, honoring $XDG_CONFIG_HOME.
func Path() string {
	if dir := os.Getenv("XDG_CONFIG_HOME"); dir != "" {
		return filepath.Join(dir, "rally", "config.json")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".", ".rally-config.json")
	}
	return filepath.Join(home, ".config", "rally", "config.json")
}

// LoadFile reads just the config file (no env overlay). A missing file is an
// empty config, not an error.
func LoadFile() (Config, error) {
	var cfg Config
	data, err := os.ReadFile(Path())
	if os.IsNotExist(err) {
		return cfg, nil
	}
	if err != nil {
		return cfg, err
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("parsing %s: %w", Path(), err)
	}
	return cfg, nil
}

// Load returns the effective config: file values overlaid with env vars.
func Load() (Config, error) {
	cfg, err := LoadFile()
	if err != nil {
		return cfg, err
	}
	cfg.Sources = map[string]string{}
	note := func(key, source, value string) {
		if value != "" {
			cfg.Sources[key] = source
		}
	}
	note("api_key", "config file", cfg.APIKey)
	note("base_url", "config file", cfg.BaseURL)
	note("workspace", "config file", cfg.Workspace)
	note("project", "config file", cfg.Project)

	overlay := func(dst *string, key, env string) {
		if v := os.Getenv(env); v != "" {
			*dst = v
			cfg.Sources[key] = "env " + env
		}
	}
	overlay(&cfg.APIKey, "api_key", "RALLY_API_KEY")
	overlay(&cfg.BaseURL, "base_url", "RALLY_BASE_URL")
	overlay(&cfg.Workspace, "workspace", "RALLY_WORKSPACE")
	overlay(&cfg.Project, "project", "RALLY_PROJECT")
	overlay(&cfg.Username, "username", "RALLY_USERNAME")
	overlay(&cfg.Password, "password", "RALLY_PASSWORD")
	return cfg, nil
}

// Save writes the file-backed fields with owner-only permissions.
func Save(cfg Config) error {
	path := Path()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o600)
}

// GetKey / SetKey address fields by their config-file key names.
func (c *Config) FieldFor(key string) (*string, bool) {
	switch key {
	case "api_key":
		return &c.APIKey, true
	case "base_url":
		return &c.BaseURL, true
	case "workspace":
		return &c.Workspace, true
	case "project":
		return &c.Project, true
	}
	return nil, false
}

// Mask hides most of a secret for display.
func Mask(s string) string {
	if s == "" {
		return ""
	}
	if len(s) <= 6 {
		return "******"
	}
	return s[:4] + "..." + "(redacted)"
}
