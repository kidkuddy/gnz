package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorCyan   = "\033[36m"
	colorDim    = "\033[2m"
	colorYellow = "\033[33m"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cmd := os.Args[1]
	switch cmd {
	case "run":
		cmdRun(os.Args[2:])
	case "session":
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "usage: hld session [create|list|messages] ...")
			os.Exit(1)
		}
		switch os.Args[2] {
		case "create":
			cmdSessionCreate(os.Args[3:])
		case "list":
			cmdSessionList()
		case "messages":
			if len(os.Args) < 4 {
				fmt.Fprintln(os.Stderr, "usage: hld session messages <session-id>")
				os.Exit(1)
			}
			cmdSessionMessages(os.Args[3])
		default:
			fmt.Fprintf(os.Stderr, "unknown session subcommand: %s\n", os.Args[2])
			os.Exit(1)
		}
	case "health":
		cmdHealth()
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n", cmd)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Fprintln(os.Stderr, `Usage:
  hld run [flags] "message"         Run a message in a session
  hld session create [flags]        Create a new session
  hld session list                  List all sessions
  hld session messages <id>         Show message history
  hld health                        Check Herald daemon health

Flags for run:
  --session, -s    Session UUID (creates new if omitted)
  --model, -m      Model override
  --dir, -d        Working directory (default: cwd)
  --mode           Permission mode (default: default)
  --herald         Herald daemon URL (default: http://localhost:9090)`)
}

func heraldURL() string {
	if v := os.Getenv("HERALD_URL"); v != "" {
		return v
	}
	return "http://localhost:9090"
}

func cmdRun(args []string) {
	var session, model, dir, mode, message string
	base := heraldURL()

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--session", "-s":
			i++
			if i < len(args) {
				session = args[i]
			}
		case "--model", "-m":
			i++
			if i < len(args) {
				model = args[i]
			}
		case "--dir", "-d":
			i++
			if i < len(args) {
				dir = args[i]
			}
		case "--mode":
			i++
			if i < len(args) {
				mode = args[i]
			}
		case "--herald":
			i++
			if i < len(args) {
				base = args[i]
			}
		default:
			message = args[i]
		}
	}

	if message == "" {
		fmt.Fprintln(os.Stderr, "error: message is required")
		os.Exit(1)
	}

	if dir == "" {
		dir, _ = os.Getwd()
	}

	// Create session if needed
	if session == "" {
		body := map[string]string{"working_dir": dir}
		if model != "" {
			body["model"] = model
		}
		if mode != "" {
			body["permission_mode"] = mode
		}
		resp, err := postJSON(base+"/sessions", body)
		if err != nil {
			fatal("creating session: %v", err)
		}
		data, ok := resp["data"].(map[string]any)
		if !ok {
			fatal("unexpected response creating session")
		}
		session = data["id"].(string)
		fmt.Fprintf(os.Stderr, "%sSession: %s%s\n", colorDim, session, colorReset)
	}

	// Run message with SSE streaming
	reqBody, _ := json.Marshal(map[string]string{"message": message})
	req, err := http.NewRequest("POST", base+"/sessions/"+session+"/message", bytes.NewReader(reqBody))
	if err != nil {
		fatal("creating request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		fatal("connecting to Herald: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		fatal("HTTP %d: %s", resp.StatusCode, string(body))
	}

	// Parse SSE stream
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 256*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			handleSSEEvent(data, base, session)
		}
	}

	fmt.Println()
}

func handleSSEEvent(data string, base string, session string) {
	var event map[string]any
	if err := json.Unmarshal([]byte(data), &event); err != nil {
		return
	}

	eventType, _ := event["type"].(string)

	switch eventType {
	case "text_delta":
		text, _ := event["text"].(string)
		fmt.Print(text)

	case "thinking_delta":
		text, _ := event["text"].(string)
		fmt.Fprintf(os.Stderr, "%s%s%s", colorDim, text, colorReset)

	case "tool_start":
		tool, _ := event["tool"].(string)
		input, _ := json.Marshal(event["input"])
		fmt.Fprintf(os.Stderr, "\n%s[%s]%s %s\n", colorCyan, tool, colorReset, string(input))

	case "tool_result":
		tool, _ := event["tool"].(string)
		output, _ := event["output"].(string)
		isError, _ := event["is_error"].(bool)
		dur, _ := event["duration_ms"].(float64)
		if isError {
			fmt.Fprintf(os.Stderr, "%s[%s error] %s%s\n", colorRed, tool, output, colorReset)
		} else {
			// Indent output
			lines := strings.Split(output, "\n")
			maxLines := 20
			if len(lines) > maxLines {
				for _, l := range lines[:maxLines] {
					fmt.Fprintf(os.Stderr, "  %s\n", l)
				}
				fmt.Fprintf(os.Stderr, "%s  ... (%d more lines)%s\n", colorDim, len(lines)-maxLines, colorReset)
			} else {
				for _, l := range lines {
					fmt.Fprintf(os.Stderr, "  %s\n", l)
				}
			}
			fmt.Fprintf(os.Stderr, "%s  (%dms)%s\n", colorDim, int(dur), colorReset)
		}

	case "permission_request":
		requestID, _ := event["request_id"].(string)
		tool, _ := event["tool"].(string)
		input, _ := json.Marshal(event["input"])
		fmt.Fprintf(os.Stderr, "\n%s[permission] %s%s %s\n", colorYellow, tool, colorReset, string(input))
		fmt.Fprintf(os.Stderr, "Allow? (y/n): ")

		reader := bufio.NewReader(os.Stdin)
		answer, _ := reader.ReadString('\n')
		answer = strings.TrimSpace(strings.ToLower(answer))
		approved := answer == "y" || answer == "yes"

		postJSON(base+"/sessions/"+session+"/permission/"+requestID, map[string]bool{"approved": approved})

	case "usage":
		inputTok, _ := event["input_tokens"].(float64)
		outputTok, _ := event["output_tokens"].(float64)
		fmt.Fprintf(os.Stderr, "%s[tokens: %d in, %d out]%s\n", colorDim, int(inputTok), int(outputTok), colorReset)

	case "turn_complete":
		reason, _ := event["stop_reason"].(string)
		fmt.Fprintf(os.Stderr, "%s[done: %s]%s\n", colorDim, reason, colorReset)

	case "error":
		msg, _ := event["message"].(string)
		fmt.Fprintf(os.Stderr, "%s[error] %s%s\n", colorRed, msg, colorReset)
	}
}

func cmdSessionCreate(args []string) {
	var dir, model, mode, id, name string
	base := heraldURL()

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--dir", "-d":
			i++
			if i < len(args) {
				dir = args[i]
			}
		case "--model", "-m":
			i++
			if i < len(args) {
				model = args[i]
			}
		case "--mode":
			i++
			if i < len(args) {
				mode = args[i]
			}
		case "--id":
			i++
			if i < len(args) {
				id = args[i]
			}
		case "--name":
			i++
			if i < len(args) {
				name = args[i]
			}
		case "--herald":
			i++
			if i < len(args) {
				base = args[i]
			}
		}
	}

	if dir == "" {
		dir, _ = os.Getwd()
	}

	body := map[string]string{"working_dir": dir}
	if model != "" {
		body["model"] = model
	}
	if mode != "" {
		body["permission_mode"] = mode
	}
	if id != "" {
		body["id"] = id
	}
	if name != "" {
		body["name"] = name
	}

	resp, err := postJSON(base+"/sessions", body)
	if err != nil {
		fatal("creating session: %v", err)
	}

	out, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Println(string(out))
}

func cmdSessionList() {
	base := heraldURL()
	resp, err := getJSON(base + "/sessions")
	if err != nil {
		fatal("listing sessions: %v", err)
	}
	out, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Println(string(out))
}

func cmdSessionMessages(id string) {
	base := heraldURL()
	resp, err := getJSON(base + "/sessions/" + id + "/messages")
	if err != nil {
		fatal("listing messages: %v", err)
	}
	out, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Println(string(out))
}

func cmdHealth() {
	base := heraldURL()
	resp, err := getJSON(base + "/health")
	if err != nil {
		fatal("health check: %v", err)
	}
	out, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Println(string(out))
}

func postJSON(url string, body any) (map[string]any, error) {
	data, _ := json.Marshal(body)
	resp, err := http.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode >= 400 {
		errMsg, _ := result["error"].(string)
		return result, fmt.Errorf("HTTP %d: %s", resp.StatusCode, errMsg)
	}
	return result, nil
}

func getJSON(url string) (map[string]any, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "error: "+format+"\n", args...)
	os.Exit(1)
}
