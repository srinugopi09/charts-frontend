VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo none)
LDFLAGS  = -ldflags "-X main.version=$(VERSION) -X main.commit=$(COMMIT)"

.PHONY: build test vet lint install clean integration

build:
	go build $(LDFLAGS) -o bin/rally ./cmd/rally

test:
	go test ./...

vet:
	go vet ./...

lint: vet
	@gofmt -l . | tee /dev/stderr | wc -l | grep -q '^0$$' || (echo "gofmt issues above" && exit 1)

install:
	go install $(LDFLAGS) ./cmd/rally

# Requires RALLY_API_KEY (and network access to Rally). Never run in CI.
integration:
	go test -tags integration ./internal/cli -run Integration -v

clean:
	rm -rf bin
