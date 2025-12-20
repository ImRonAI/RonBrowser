# Ron Browser Agent System Architecture

## Overview
Ron Browser uses the **Strands** framework pattern for multi-agent orchestration. The system is designed to have a primary "Orchestrator" (The User's ron) and specialized sub-agents.

## Core Agents

### 1. The Monolith (Orchestrator)
- **Role**: Main interface with the user.
- **Responsibilities**:
    - Intent recognition (Is this a search? A coding task? A browse action?).
    - Delegation to sub-agents.
    - Synthesis of results into a coherent UI.
    - Maintaining user context and preferences (from Onboarding).

### 2. Browser Agent (Navigator)
- **Role**: Autonomous web navigation.
- **Tools**:
    - `goTo(url)`
    - `click(selector)`
    - `extract(selector)`
    - `scroll()`
- **Implementation**: Uses Electron's `BrowserView` or Puppeteer/Playwright connection (TBD).

### 3. Researcher Agent
- **Role**: Deep dive information gathering.
- **Workflow**:
    - Generates search queries.
    - Scrapes top results.
    - Summarizes findings.
    - Follows citations.

## Implementation Plan (Strands)

1. **State Management**: `agentStore` holds the conversation history and the active "Thread".
2. **Tool Registry**: A central registry of tools available to agents.
3. **Context Window**: Dynamic context management to keep relevant info in scope.

## Current Status
- [x] UI Panel (`AgentPanel`)
- [x] Onboarding Data (Personalization Context)
- [ ] Agent Logic Implementation
- [ ] Tool definitions
