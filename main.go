package main

import (
	"bytes"
	"compress/gzip"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var (
	compiledTemplates *template.Template
	cssBundle         []byte
)

func init() {
	// 1. In-Memory Template Caching
	var err error
	compiledTemplates, err = template.ParseFiles("index.html")
	if err != nil {
		log.Fatalf("Error parsing index.html: %v", err)
	}

	moduleFiles, err := filepath.Glob("modules/*/*.html")
	if err == nil && len(moduleFiles) > 0 {
		compiledTemplates, err = compiledTemplates.ParseFiles(moduleFiles...)
		if err != nil {
			log.Fatalf("Error parsing module templates: %v", err)
		}
	}

	// 2. Zero-Latency CSS Bundling (Concatenate all CSS into memory)
	var cssBuffer bytes.Buffer

	// Add core theme first
	coreCSS, _ := os.ReadFile("core/theme.css")
	cssBuffer.Write(coreCSS)
	cssBuffer.WriteString("\n")

	// Add all module CSS files
	cssFiles, _ := filepath.Glob("modules/*/*.css")
	for _, file := range cssFiles {
		content, _ := os.ReadFile(file)
		cssBuffer.Write(content)
		cssBuffer.WriteString("\n")
	}
	cssBundle = cssBuffer.Bytes()
	log.Printf("Successfully bundled %d CSS files into memory.", len(cssFiles)+1)
}

// gzipResponseWriter wraps http.ResponseWriter to compress output
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

// gzipMiddleware compresses HTTP responses to minimize network latency
func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Del("Content-Length")
		gz := gzip.NewWriter(w)
		defer gz.Close()
		gzw := gzipResponseWriter{Writer: gz, ResponseWriter: w}
		next.ServeHTTP(gzw, r)
	})
}

func main() {
	mux := http.NewServeMux()

	// Serve Bundled CSS directly from RAM
	mux.HandleFunc("/assets/bundle.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(cssBundle)
	})

	// Serve JS modules as static files (Browsers parallelize ES modules natively very well)
	mux.Handle("/core/", http.StripPrefix("/core/", http.FileServer(http.Dir("core"))))
	mux.Handle("/modules/", http.StripPrefix("/modules/", http.FileServer(http.Dir("modules"))))
	mux.Handle("/main.js", http.FileServer(http.Dir(".")))

	// Serve the main index page directly from RAM (No disk I/O)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/index.html" {
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		// Force browser not to cache HTML so we always get the latest state on refresh
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

		// Execute template from RAM
		err := compiledTemplates.Execute(w, nil)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	// Wrap the entire router with GZIP compression
	compressedHandler := gzipMiddleware(mux)

	server := &http.Server{
		Addr:         ":80",
		Handler:      compressedHandler,
		ReadTimeout:  5 * time.Second,  // Prevent slow-loris and free up connections fast
		WriteTimeout: 10 * time.Second, // Fast writes for zero latency
		IdleTimeout:  120 * time.Second,
	}

	log.Println("⚡ Zero-Latency Architect Server started on http://localhost:80")
	log.Fatal(server.ListenAndServe())
}
