package main

import (
	"os"

	"github.com/srinugopi09/rally-cli/internal/cli"
)

// Injected at build time via -ldflags (see Makefile).
var (
	version = "dev"
	commit  = "none"
)

func main() {
	os.Exit(cli.Execute(version, commit))
}
