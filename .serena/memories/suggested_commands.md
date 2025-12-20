# Development Commands

## Essential Commands
```bash
# Install dependencies
npm install

# Run in development mode (starts Electron with hot reload)
npm run dev

# Build for production
npm run build

# Start built app
npm start

# Package Electron app (creates distributable)
npm run package

# Type checking (no tests configured yet)
npm run lint
npm run typecheck
```

## CRITICAL: Testing
**DO NOT use MCP servers or browser-based testing methods** - this is an Electron desktop app. Always test with `npm run dev` which launches the Electron app.

## Debugging
- Keyboard shortcut: `Cmd/Ctrl+Shift+K` resets app state
- `RESET_APP_ON_LAUNCH` flag in `App.tsx` can clear storage for development
