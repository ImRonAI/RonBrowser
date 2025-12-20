# Code Style and Conventions

## Path Aliases
Use `@/` for src imports and `@catalyst/` for Catalyst components:
```typescript
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@catalyst/button'
```

## Architecture Patterns
- **State Management**: Zustand stores with `persist` middleware
- **IPC Communication**: Main process exposes APIs via preload script
- **Component Structure**: Catalyst components as base, extended with TailwindCSS

## TypeScript
- Strict mode enabled
- Type definitions in `/src/types/`
- Path aliases configured in `tsconfig.json`

## Styling
- Use TailwindCSS utility classes
- Support all three themes: `dark:`, `glass:` variants
- Color tokens: royal, ron-white, ron-black, ron-smoke
- Typography: Georgia (headers), Raleway (body)
