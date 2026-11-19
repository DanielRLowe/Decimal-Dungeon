// Decimal Dungeon's Windows launcher serves the embedded game to the local browser.
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"time"
)

//go:embed web
var game embed.FS

const address = "127.0.0.1:47651"
const gameURL = "http://" + address + "/"

func launch() {
	fmt.Println("Open", gameURL, "in your browser to play.")
	if err := exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", gameURL).Start(); err != nil {
		fmt.Println("The browser could not be opened automatically.")
	}
}

func run() error {
	listener, err := net.Listen("tcp4", address)
	if err != nil {
		client := http.Client{Timeout: time.Second}
		response, probeErr := client.Head(gameURL)
		if probeErr == nil {
			defer response.Body.Close()
			if response.Header.Get("X-Decimal-Dungeon") == "game" {
				launch()
				return nil
			}
		}
		return fmt.Errorf("could not start the game on %s: %w", address, err)
	}
	defer listener.Close()
	assets, err := fs.Sub(game, "web")
	if err != nil {
		return err
	}
	files := http.FileServer(http.FS(assets))
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != address {
			http.Error(w, "Unknown host", http.StatusForbidden)
			return
		}
		w.Header().Set("X-Decimal-Dungeon", "game")
		w.Header().Set("Cache-Control", "no-cache")
		files.ServeHTTP(w, r)
	})
	fmt.Println("Decimal Dungeon — keep this window open while playing. Close it when finished.")
	launch()
	server := &http.Server{Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	return server.Serve(listener)
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		fmt.Println("Press Return to close.")
		fmt.Scanln()
		os.Exit(1)
	}
}
