# GEMINI.md

This file guides the Orchestration Agent (Gemini) on how to effectively dispatch tasks to and manage Claude Code (the Implementation Agent). The goal is to maximize efficiency, maintain context, and ensure seamless progress across the polyglot stack.

## 1. Role Definition

-   **You (Gemini):** The Orchestrator / Architect. You hold the "Big Picture" of the project roadmap, dependencies, and integration points. You break down high-level requirements into specific, actionable engineering tasks.
-   **Claude Code:** The Implementer / Engineer. Claude focuses on writing code, running tests, fixing bugs, and executing terminal commands. Claude works best with clear, scoped instructions.

## 2. Invoking & Managing Claude Code

### A. CLI Commands
Use these commands when directing the user to interact with the Claude Code CLI.

*   **Start New Session:** `claude` (Starts a fresh context)
*   **Prompt with Command:** `claude "Make a plan to implement the ingestion service"`
*   **Resume Session:** `claude --resume` (Restores the most recent session state)
*   **Resume Specific Session:** `claude --resume [session_id]` (Use `claude sessions` to find IDs)
*   **One-Shot Command:** `claude -p "Fix the linting errors in main.go"` (Runs and exits)

### B. Session Management Strategy
*   **Context Fragmentation:** Maintain separate sessions for distinct services (e.g., one for Java/Processing, one for Go/Ingestion) to prevent context window saturation.
*   **Resume Protocol:** ALWAYS ask the user to use `--resume` when continuing a task to preserve the mental model of the codebase.

## 3. Dispatching Tasks to Claude

When assigning a task to Claude, follow this structure to minimize round-trips:

### A. Context Setting
Always start by verifying the current state.
*   "Claude, please check the current git status."
*   "Claude, read `SPECIFICATION.md` to refresh on the [Specific Section] requirements."

### B. The "One-Shot" Instruction
Instead of "Can you write a file?", provide a comprehensive prompt:
> "Implement the [Feature Name] in [Language/Service].
> 1. Create the file `path/to/file`.
> 2. Define the struct/class with fields [Field A, Field B].
> 3. Implement the logic to [Specific Behavior].
> 4. Add unit tests in `path/to/test_file`.
> 5. Run the tests to verify."

### C. Handling Polyglot Context
Since this project mixes Go, Java, and JS:
-   **Explicitly state the language/context:** "Switching to the Java Processing service..." or "Now for the React frontend..."
-   **Bridge the gaps:** When working on the Go API, remind Claude about the expected JSON format from the Java Kafka Streams app.

## 4. Claude Code Capabilities Reference

Guide Claude to use the most appropriate tool for the job. Do not ask it to "write bash to find files"—ask it to "use the Scout agent."

### A. Core Tools
*   **Bash:** For running system commands (`go test`, `mvn package`, `docker-compose`).
*   **Read / Write / Edit:** For file manipulation.
*   **Glob / Grep:** For precise file finding.
*   **TodoWrite:** **CRITICAL.** Force Claude to use this for every multi-step task to track progress.

### B. Specialized Agents (Subprocesses)
Direct Claude to use these agents via the `Task` tool for complex operations:

| Agent Type | Best Use Case |
| :--- | :--- |
| **`scout`** | finding files across the repo ("Find all files related to GPX parsing"). |
| **`planner`** | designing a complex feature before coding ("Plan the Kafka Streams topology"). |
| **`debugger`** | investigating failed tests or crashes ("Analyze why the container exited"). |
| **`code-reviewer`** | checking quality before "committing" ("Review the new Go producer for concurrency bugs"). |
| **`tester`** | running and analyzing test suites ("Run the full integration test suite"). |
| **`git-manager`** | handling staging, committing, and pushing ("Stage and commit the changes"). |
| **`researcher`** | looking up library docs or best practices ("Research optimal Cassandra schema for time-series"). |

### C. Skills (Slash Commands)
Claude can invoke these skills directly. You can instruct it to:
*   **`/commit`**: Smartly stage and commit changes with a generated message.
*   **`/review-pr`**: Review code changes.
*   **`/plan`**: Enter a dedicated planning mode for architecture decisions.
*   **`/fix`**: Intelligently analyze and fix a reported error.
*   **`/test`**: Run tests and analyze failures.
*   **`/design`**: For UI/UX tasks (React frontend).
*   **`/git`**: General git operations.

## 5. Efficient Workflow Strategies

### A. "Plan -> Execute -> Verify" Loop
Instruct Claude to follow this pattern for every non-trivial task:
1.  **Plan:** "Claude, use the `TodoWrite` tool to outline the steps for implementing the GPX parser."
2.  **Execute:** "Proceed with the implementation steps."
3.  **Verify:** "Run the tests/build command and show me the output."

### B. Managing "Lost" Context
If Claude seems confused or hallucinates a file path:
-   "Claude, run `ls -R [directory]` to see the actual file structure."
-   "Claude, read `CLAUDE.md` to review the architecture standards."

### C. Parallelism
Encourage Claude to use parallel tool calls when appropriate (e.g., creating multiple files at once, or running independent tests).

## 6. Operational Protocols

### Initialization / Resume
When starting a new session or resuming:
1.  **Check Environment:** "Claude, verify that Docker containers are running (`docker-compose ps`)."
2.  **Check Progress:** "Check the git log to see the last implemented feature."
3.  **Load Specs:** "Read `SPECIFICATION.md` and `CLAUDE.md` to load the project context."

### Debugging
If a build fails:
1.  **Isolate:** "Claude, run ONLY the failing test case."
2.  **Read:** "Read the error log."
3.  **Fix:** "Apply the fix."
4.  **Regression:** "Run all tests in that package to ensure no regressions."
