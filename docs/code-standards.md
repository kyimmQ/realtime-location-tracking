# Code Standards & Workflows

**Version:** 1.0.0
**Last Updated:** 2026-01-29

## 1. Coding Standards

### 1.1 General Principles
- **KISS (Keep It Simple, Stupid):** Avoid over-engineering.
- **DRY (Don't Repeat Yourself):** Abstract common logic but beware of premature optimization.
- **YAGNI (You Ain't Gonna Need It):** Implement only what is currently required.
- **Composition over Inheritance:** Prefer small, composable units of logic.

### 1.2 Naming Conventions
- **Files & Directories:** `kebab-case` (e.g., `user-profile.go`, `data-processing/`).
- **Variables & Functions:** Language-specific idioms:
  - **Go:** `camelCase`, exported names `PascalCase`.
  - **Java:** `camelCase` for methods/vars, `PascalCase` for classes.
  - **React/JS:** `camelCase` for variables, `PascalCase` for components.
- **Descriptive Names:** Use `driverLocation` instead of `dLoc`.

### 1.3 Code Structure
- **File Size:** Aim for < 200 lines per file to maintain readability.
- **Modularity:** Each module/package should have a single responsibility.
- **Comments:** Explain *why*, not *what*. Code should be self-documenting where possible.

## 2. Development Workflow

The project follows a rigorous agentic workflow:

1.  **Plan:** (Planner/Researcher)
    - Analyze requirements.
    - Create a plan in `./plans/YYMMDD-HHMM-{slug}/`.
2.  **Compile:**
    - Ensure code builds without errors.
3.  **Test:** (Tester)
    - Write unit and integration tests.
    - High coverage required.
    - **Zero ignored failures:** All tests must pass.
4.  **Review:** (Code Reviewer)
    - Static analysis and logic verification.
    - Adherence to these standards.
5.  **Integrate:**
    - Merge changes to the main branch.
6.  **Debug:** (Debugger)
    - Isolate and fix issues found during testing or integration.

## 3. Documentation

- **Location:** All documentation resides in `./docs/`.
- **Plans:** Task-specific plans reside in `./plans/`.
- **Format:** Markdown (`.md`).
- **Updates:** Documentation must be updated *proactively* as code changes.

## 4. Tooling
- **Scripts:** Run Python scripts using the venv: `.claude/skills/.venv/bin/python3`.
- **Linting:** Standard linters for Go (golangci-lint) and Java (Checkstyle/SpotBugs) are recommended.
