# Codebase Summary

**Version:** 1.0.0
**Last Updated:** 2026-01-29

## 1. Directory Structure

```
/
├── .claude/                # Claude Code configuration and workflows
│   ├── workflows/          # Operational workflows (primary, dev rules, etc.)
│   └── skills/             # Python scripts and tools
├── docs/                   # Project documentation (Architecture, PDR, Standards)
├── plans/                  # Task execution plans (timestamped folders)
├── src/                    # Source code (Planned structure)
│   ├── ingestion-service/  # Go service for data intake
│   ├── processing-engine/  # Java/Kafka Streams processing
│   ├── serving-service/    # Go service for API and WebSockets
│   └── frontend/           # React application
├── CLAUDE.md               # Main instruction file for AI agents
├── README.md               # Project entry point
└── SPECIFICATION.md        # Initial project specs
```

## 2. Key Directories

### 2.1 `docs/`

Contains the source of truth for project knowledge.

- `project-overview-pdr.md`: Requirements and goals.
- `system-architecture.md`: Technical design and data flow.
- `code-standards.md`: Rules for development.

### 2.2 `plans/`

Ephemeral workspaces for specific tasks. Named as `YYMMDD-HHMM-{slug}`. Contains:

- `plan.md`: The execution strategy.
- `reports/`: Progress and summary reports.

## 3. Tech Stack Summary

- **Languages:** Go, Java, TypeScript/JavaScript.
- **Infrastructure:** Apache Kafka, Apache Cassandra.
- **Frontend:** React.

## 4. Current State

- **Phase:** Initialization & Documentation.
- **Next Steps:** Setting up project scaffolding for the microservices.
