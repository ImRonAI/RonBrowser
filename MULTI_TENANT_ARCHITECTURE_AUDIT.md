# Ron Browser Multi-Tenant Architecture Audit Report
**Generated**: January 13, 2026
**Analyzed Codebase**: /Users/timhunter/Library/Mobile Documents/com~apple~CloudDocs/ronbrowser
**Total Files Analyzed**: 2,443 TypeScript/JavaScript/Python files

---

## Executive Summary

Ron Browser is currently architected as a **single-user Electron application** with fundamental architectural limitations preventing true multi-tenant support. While basic user-scoped data patterns exist in the database layer, the application's core architecture enforces single-instance, single-user operation at the Electron process level.

### Overall Multi-Tenancy Rating: **❌ Not Multi-Tenant Ready**

**Implementation Complexity**: **Very Heavy** - Requires significant architectural refactoring across all layers

### Key Findings:
1. **Electron Main Process**: Enforces single-instance application lock, single global window, shared state
2. **Frontend State**: Global Zustand stores with localStorage persistence cause user data conflicts
3. **Backend Agents**: No tenant isolation, shared global configuration, workspace collisions
4. **Data Storage**: User-based tenancy foundation exists but lacks enforcement and isolation
5. **Configuration**: Minimal multi-tenant configuration infrastructure, shared secrets/API keys

---

## Critical Multi-Tenant Architecture Issues

### 🚨 **Severity: CRITICAL** - Application Foundation Issues

#### 1. Single-Instance Application Lock
**Location**: `electron/main.ts:32-35`

```typescript
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}
```

**Impact**: Only ONE instance of the application can run at a time. Multiple users cannot run separate instances simultaneously.

**Required Change**: Remove single-instance lock OR implement multi-window architecture with user context per window.

---

#### 2. Single Global Window Instance
**Location**: `electron/main.ts:37`

```typescript
let mainWindow: BrowserWindow | null = null
```

**Impact**: All users share the same window instance. No isolation between user sessions.

**Required Change**: Implement window manager that creates isolated window instances per user/tenant.

---

#### 3. Global Shared State in Main Process
**Location**: `electron/main.ts`

Critical global variables:
- Line 52: `const cachedTokens: Map<string, string> = new Map()` - Shared token cache
- Line 38: `let currentTheme: Theme = 'system'` - Shared theme state
- Line 728-732: Single `voiceAgentProcess` - No per-user process isolation

**Impact**: User data leakage, authentication token conflicts, resource contention.

**Required Change**: Refactor to user-scoped state management with explicit tenant context.

---

### 🔴 **Severity: HIGH** - Data Isolation Issues

#### 4. Global localStorage Persistence
**Location**: All Zustand stores in `src/stores/`

```typescript
// Example from authStore.ts
persist: (store) => ({
  name: 'auth-store',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  }),
})
```

**Impact**: When a new user logs in, their data overwrites the previous user's stored state in the same localStorage namespace.

**Required Change**: Implement user-scoped storage keys (e.g., `auth-store-${userId}`) or separate storage contexts per user.

---

#### 5. Shared Sandbox Root Directory
**Location**: `electron/main.ts:1049-1052`

```typescript
function getSandboxRoot(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'agent-sandbox')
}
```

**Impact**: All users share the same sandbox directory for agent operations. File conflicts and data leakage possible.

**Required Change**: Implement per-user sandbox directories: `agent-sandbox-${userId}`

---

#### 6. Session Directory Structure - Single User
**Location**: `.sessions/` directory

**Current Pattern**:
```
.sessions/
  session_ron-1768328047/
  session_ron-1768328455/
  session_ron-1768328850/
  ...
```

**Issue**: All sessions use hardcoded "ron" user identifier. No support for multiple actual users.

**Required Change**: Implement user-scoped session directories: `.sessions/${userId}/session-${timestamp}/`

---

### 🟡 **Severity: MEDIUM** - Backend & Configuration Issues

#### 7. Python Agent Backend - No Tenant Isolation
**Location**: `agent/` directory, `dist/agents/Ron/ron_dspy/`

**Issues**:
- Global environment variable configuration (DC_API_KEY, AGENT_MODEL)
- No workspace virtualization for file access
- Session ID uniqueness relies on caller, no enforcement
- No tenant context passed to agent instances

**Example**: `dist/agents/Ron/ron_dspy/persistence/supabase.py`
```python
def save_session(self, session_id: str, session_data: Dict[str, Any]) -> Dict[str, Any]:
    session_data["id"] = session_id
    result = self.client.table("agent_sessions").upsert(session_data).execute()
```

**Impact**: Potential session ID collisions, no access control checks, data leakage between tenants.

**Required Change**:
- Add tenant/user context to all agent operations
- Implement access control checks in persistence layer
- Create isolated workspaces per tenant

---

#### 8. Shared API Keys and Credentials
**Location**: Configuration files and environment variables

**Issues**:
- `src/api/sonar-reasoning-pro.ts`: `process.env.PERPLEXITY_API_KEY` shared globally
- No per-tenant API key management
- Shared Supabase connection across all users
- No billing/quota isolation per tenant

**Impact**: All users share the same API quotas and billing, no cost attribution per tenant.

**Required Change**: Implement tenant-specific API key management and usage tracking.

---

#### 9. Missing Multi-Tenant Configuration Infrastructure
**Location**: No centralized configuration system

**Issues**:
- No tenant-specific feature flags
- No tenant configuration database table
- Missing logging isolation (can't distinguish tenant actions in logs)
- No tenant-aware error tracking

**Required Change**: Build comprehensive multi-tenant configuration system with:
- Tenant metadata table
- Feature flags per tenant
- Tenant-scoped logging and monitoring
- Usage tracking and billing integration

---

## Layer-by-Layer Architecture Analysis

### 🖥️ **Layer 1: Electron Main Process**

**Current Architecture**: Single-user, single-window, global state

**Multi-Tenant Readiness**: ❌ **0%** - Fundamentally incompatible

**Key Files**:
- `electron/main.ts` - Main process entry (482 lines)
- `electron/tool-manager.ts` - Tool execution management
- `electron/browser-service.ts` - Browser service orchestration
- `electron/preload.ts` - Renderer API bridge

**Architectural Patterns Blocking Multi-Tenancy**:
1. **Single Instance Lock**: Lines 32-35 prevent multiple app instances
2. **Singleton Window**: Line 37 - only one `mainWindow` instance
3. **Global State Variables**:
   - Token cache (line 52)
   - Theme state (line 38)
   - Voice agent process (lines 728-732)
   - Active streams map (line 586)
4. **Shared Resources**:
   - Single `TabsManager` instance (line 363)
   - Shared sandbox root directory
   - Global agent process management

**Positive Security Aspects**:
- ✅ Context isolation enabled
- ✅ Preload script for controlled IPC
- ✅ Sandbox implementation with path traversal prevention
- ✅ Timeout controls for shell commands

**Required Architectural Changes**:

| Component | Current State | Required Change | Complexity |
|-----------|---------------|-----------------|------------|
| Window Management | Single global window | Multi-window manager with user context | Heavy |
| State Management | Global variables | User-scoped state containers | Heavy |
| Process Management | Shared processes | Per-user process isolation | Very Heavy |
| IPC Handlers | Global handlers | User-context-aware handlers | Heavy |
| Sandbox | Shared root | Per-user sandboxes | Not Bad |
| Token Storage | In-memory Map | User-namespaced secure storage | Easy |

---

### 🎨 **Layer 2: Frontend State Management**

**Current Architecture**: Zustand stores with global localStorage persistence

**Multi-Tenant Readiness**: 🟡 **30%** - Foundation exists but needs isolation

**Key Files**:
- `src/stores/authStore.ts` - Authentication state
- `src/stores/agentStore.ts` - Agent management
- `src/stores/taskStore.ts` - Task tracking
- `src/stores/userPreferencesStore.ts` - User preferences
- `src/stores/tabStore.ts` - Browser tab state
- `src/types/user.ts` - User type definitions

**Positive Multi-Tenant Aspects**:
- ✅ User-based tenancy model implemented: `tenantId: supabaseUser.id`
- ✅ Placeholder for organization-based tenancy: `organizations` field
- ✅ User type includes tenant metadata
- ✅ Supabase queries include user_id filtering

**Issues Preventing Multi-Tenancy**:
1. **Global localStorage Keys**: All stores use fixed storage keys without user namespacing
   ```typescript
   persist: (store) => ({
     name: 'auth-store',  // ❌ Same key for all users
     storage: createJSONStorage(() => localStorage),
   })
   ```

2. **State Overwrites on Login**: New user login overwrites previous user's persisted state

3. **No State Isolation Mechanism**: Stores assume single-user context

4. **Token Management**:
   ```typescript
   // From authStore.ts - stores tokens via Electron IPC
   await window.electron.auth?.storeTokens(session.access_token, session.refresh_token)
   ```
   Uses global Electron token storage without user namespacing

**Required Changes**:

```typescript
// BEFORE (Current - Single User)
persist: (store) => ({
  name: 'auth-store',
  storage: createJSONStorage(() => localStorage),
})

// AFTER (Multi-Tenant)
persist: (store) => ({
  name: `auth-store-${getCurrentUserId()}`,  // User-scoped key
  storage: createJSONStorage(() => localStorage),
})

// OR better - separate storage context per user
const userStorage = getUserStorage(userId)
persist: (store) => ({
  name: 'auth-store',
  storage: createJSONStorage(() => userStorage),
})
```

**Database Schema - Multi-Tenant Ready**:
```typescript
// src/types/user.ts
export interface User {
  id: string
  tenant_id: string          // ✅ Tenant isolation field
  email: string
  name?: string
  avatar?: string
  organizations?: string[]   // ✅ Future org support
  preferences?: UserPreferences
  created_at: string
  updated_at: string
}
```

**Recommendations**:
1. Implement user-scoped storage wrapper
2. Add user context provider at app root
3. Create state reset mechanism on user switch
4. Namespace all localStorage/sessionStorage keys with userId
5. Enhance token storage IPC to include user context

---

### 🐍 **Layer 3: Python Agent Backend**

**Current Architecture**: Stateless agent instances with Supabase persistence

**Multi-Tenant Readiness**: 🟡 **40%** - Session-based isolation exists but incomplete

**Key Files**:
- `agent/tools/strands-fun-tools/agent.py` - Agent implementation
- `dist/agents/Ron/ron_dspy/persistence/supabase.py` - Persistence layer
- `verify_persistence_logic.py` - Persistence testing
- `agent/api/main.py` - Backend API entry (from package.json)

**Positive Multi-Tenant Aspects**:
- ✅ Session-based data isolation via `session_id`
- ✅ Supabase persistence with user-scoped tables
- ✅ Save/load session capabilities
- ✅ Task management with user association

**Supabase Persistence Example**:
```python
# dist/agents/Ron/ron_dspy/persistence/supabase.py
def save_session(self, session_id: str, session_data: Dict[str, Any]) -> Dict[str, Any]:
    session_data["id"] = session_id
    result = self.client.table("agent_sessions").upsert(session_data).execute()
    return result.data[0] if result.data else {}

def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
    result = self.client.table("agent_sessions")\
        .select("*")\
        .eq("id", session_id)\
        .single()\
        .execute()
    return result.data
```

**Issues Preventing True Multi-Tenancy**:

1. **No Access Control Checks**: Persistence methods don't verify user permissions
   ```python
   # ❌ Missing: tenant/user verification
   def get_session(self, session_id: str):
       # Should verify: does requesting user own this session?
       result = self.client.table("agent_sessions").select("*").eq("id", session_id).single().execute()
   ```

2. **Global Configuration**: Environment variables shared across all agent instances
   ```python
   DC_API_KEY = os.environ.get("DC_API_KEY")
   AGENT_MODEL = os.environ.get("AGENT_MODEL", "gemini-2.5-flash")
   ```

3. **No Workspace Isolation**: File system access patterns not properly isolated
   - Agents could potentially access files outside their workspace
   - No virtualized filesystem per tenant

4. **Session ID Collision Risk**: Relies on caller to generate unique IDs, no enforcement

5. **No Explicit Tenant Context**: Agent instances don't carry user/tenant metadata
   ```python
   # Missing in agent initialization
   class Agent:
       def __init__(self, config):
           # ❌ No tenant_id or user_id parameter
           self.config = config
   ```

**Required Changes**:

```python
# BEFORE (Current)
class SupabaseClient:
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        result = self.client.table("agent_sessions")\
            .select("*")\
            .eq("id", session_id)\
            .single()\
            .execute()
        return result.data

# AFTER (Multi-Tenant)
class SupabaseClient:
    def get_session(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        # Verify user owns this session
        result = self.client.table("agent_sessions")\
            .select("*")\
            .eq("id", session_id)\
            .eq("user_id", user_id)\  # ✅ User verification
            .single()\
            .execute()

        if not result.data:
            raise PermissionError(f"Session {session_id} not found or access denied")

        return result.data
```

**Workspace Isolation Recommendation**:
```python
# Create tenant-specific workspace
class TenantWorkspace:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.root = f"/workspaces/{tenant_id}"
        self._ensure_isolated()

    def get_path(self, relative_path: str) -> str:
        # Prevent path traversal
        abs_path = os.path.abspath(os.path.join(self.root, relative_path))
        if not abs_path.startswith(self.root):
            raise SecurityError("Path traversal detected")
        return abs_path
```

**Recommendations**:
1. Add user_id/tenant_id to all agent operations
2. Implement mandatory access control checks
3. Create isolated workspace per tenant
4. Add tenant context to agent initialization
5. Implement per-tenant configuration
6. Add usage tracking and billing hooks

---

### 💾 **Layer 4: Data Storage & Persistence**

**Current Architecture**: Supabase with user-based tenancy foundation

**Multi-Tenant Readiness**: 🟢 **60%** - Best layer for multi-tenancy

**Key Files**:
- `src/types/supabase.ts` - Database type definitions
- `src/api/supabase.ts` - Supabase client and API
- `.sessions/` - Session storage directory (filesystem)

**Database Schema - Multi-Tenant Structure**:

```typescript
// From src/types/supabase.ts
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string                    // Primary key
          tenant_id: string            // ✅ Tenant isolation
          email: string
          name: string | null
          avatar: string | null
          organizations: string[] | null
          created_at: string
          updated_at: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string              // ✅ User scoping
          theme: string
          notifications: boolean
          // ...
        }
      }
      interests: {
        Row: {
          id: string
          user_id: string              // ✅ User scoping
          name: string
          category: string
          // ...
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string              // ✅ User scoping
          title: string
          created_at: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          user_id: string              // ✅ User scoping
          role: string
          content: string
          created_at: string
        }
      }
    }
  }
}
```

**Positive Multi-Tenant Aspects**:
- ✅ **User-based tenancy**: Every table includes `user_id` for row-level isolation
- ✅ **Tenant ID field**: `users` table has explicit `tenant_id` column
- ✅ **Type-safe queries**: TypeScript types enforce correct data access patterns
- ✅ **Organization support**: Future multi-org structure in place
- ✅ **Graceful degradation**: Handles missing tables/credentials
- ✅ **Secure credential management**: Environment-based, not hardcoded

**Supabase Client Configuration**:
```typescript
// From src/api/supabase.ts
const getSupabaseConfig = (): SupabaseConfig => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.warn('⚠️ Supabase credentials not configured.')
  }

  return {
    url: url || 'https://placeholder.supabase.co',    // ✅ Safe fallback
    anonKey: anonKey || 'placeholder-anon-key',       // ✅ Safe fallback
  }
}
```

**Issues & Gaps**:

1. **No Row-Level Security (RLS) Policies Enforced in Code**:
   - While Supabase supports RLS, the TypeScript code doesn't show explicit policy implementation
   - Queries rely on manual `user_id` filtering rather than enforced RLS

2. **Single Supabase Project for All Tenants**:
   - All tenants share the same Supabase database instance
   - No physical data isolation between tenants
   - Risk: Database compromise affects all tenants

3. **Shared Connection Pool**:
   - No per-tenant connection management
   - No query quota limits per tenant

4. **Session Storage on Filesystem**:
   ```
   .sessions/
     session_ron-1768328047/    # ❌ Hardcoded "ron" user
     session_ron-1768328455/
   ```
   - All sessions use "ron" identifier
   - No proper user scoping in filesystem storage
   - Should be: `.sessions/${userId}/session-${timestamp}/`

5. **Missing Audit Trail**:
   - No cross-tenant activity logging
   - Can't track which tenant performed what action
   - No billing/usage attribution

**Required RLS Policies (Supabase)**:
```sql
-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = id);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own data"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Apply similar policies to all tables with user_id
```

**Filesystem Session Storage Refactor**:
```typescript
// BEFORE (Current - Single User)
const sessionDir = `.sessions/session_ron-${timestamp}`

// AFTER (Multi-Tenant)
const getUserSessionDir = (userId: string, sessionId: string) => {
  return `.sessions/${userId}/${sessionId}`
}

// Create isolated session storage
const sessionDir = getUserSessionDir(currentUser.id, `session-${timestamp}`)
```

**Recommendations**:
1. **Implement Supabase RLS policies** for all tables
2. **Refactor filesystem session storage** to use user-scoped directories
3. **Add audit logging** for cross-tenant activity tracking
4. **Implement tenant-aware backup/restore** procedures
5. **Add usage metrics** per tenant for billing
6. **Consider tenant isolation strategies**:
   - Schema-per-tenant (most isolated, complex)
   - Database-per-tenant (isolated, expensive)
   - Row-level with RLS (current approach, cost-effective)

---

### ⚙️ **Layer 5: Configuration & Environment**

**Current Architecture**: Minimal configuration management, environment variables

**Multi-Tenant Readiness**: ❌ **10%** - No multi-tenant infrastructure

**Key Files**:
- `.env` (not in repo, but referenced)
- `package.json` - Build scripts and dependencies
- `electron.vite.config.ts` - Build configuration
- `src/api/sonar-reasoning-pro.ts` - API client with env usage

**Issues Preventing Multi-Tenancy**:

1. **No Centralized Configuration System**:
   - Configuration scattered across multiple files
   - No single source of truth for app settings

2. **Global Environment Variables**:
   ```typescript
   // From sonar-reasoning-pro.ts
   const apiKey = this.options.apiKey || process.env.PERPLEXITY_API_KEY
   ```
   - All users share the same API keys
   - No per-tenant API configuration
   - No quota management

3. **Missing Multi-Tenant Config Table**:
   - No database table for tenant-specific settings
   - No feature flags per tenant
   - No tenant metadata management

4. **No Tenant-Aware Logging**:
   ```typescript
   console.warn('⚠️ Supabase credentials not configured.')
   ```
   - Logs don't include user/tenant context
   - Can't filter logs by tenant
   - No tenant-specific error tracking

5. **Build-time Configuration Only**:
   - No runtime configuration updates
   - Can't change tenant settings without rebuild

6. **No Secrets Management**:
   - Environment variables directly accessed
   - No encryption of sensitive configuration
   - No secret rotation mechanism

**Required Multi-Tenant Configuration Architecture**:

```typescript
// Tenant Configuration Table Schema
interface TenantConfig {
  tenant_id: string
  features: {
    voice_agent_enabled: boolean
    max_concurrent_sessions: number
    ai_model: string
    api_quotas: {
      perplexity_requests_per_day: number
      openai_tokens_per_month: number
    }
  }
  billing: {
    plan: 'free' | 'pro' | 'enterprise'
    usage_tracked: boolean
  }
  integrations: {
    supabase_project_id: string
    custom_api_keys: {
      perplexity?: string
      openai?: string
    }
  }
  limits: {
    max_storage_gb: number
    max_users: number
  }
  created_at: string
  updated_at: string
}

// Configuration Service
class ConfigService {
  async getTenantConfig(tenantId: string): Promise<TenantConfig> {
    // Load from database with caching
  }

  async updateTenantConfig(tenantId: string, updates: Partial<TenantConfig>) {
    // Update with validation and audit logging
  }

  isFeatureEnabled(tenantId: string, feature: string): boolean {
    // Feature flag check
  }
}
```

**Tenant-Aware Logging**:
```typescript
// BEFORE (Current)
console.log('User logged in')

// AFTER (Multi-Tenant)
logger.info('User logged in', {
  tenant_id: currentTenant.id,
  user_id: currentUser.id,
  timestamp: new Date().toISOString(),
  session_id: currentSession.id
})
```

**Recommendations**:
1. **Create tenant_config table** in Supabase
2. **Implement ConfigService** for centralized configuration
3. **Add tenant-aware logging** with structured metadata
4. **Implement feature flags** per tenant
5. **Add secrets management** with encryption
6. **Create usage tracking** for billing attribution
7. **Build tenant admin dashboard** for self-service config

---

## Detailed Issue Matrix

| Issue # | Component | Issue Description | Severity | Current State | Required Change | Complexity |
|---------|-----------|-------------------|----------|---------------|-----------------|------------|
| 1 | Electron Main | Single-instance application lock | 🚨 Critical | Enforced at app.requestSingleInstanceLock() | Remove OR redesign for multi-window | Very Heavy |
| 2 | Electron Main | Single global mainWindow | 🚨 Critical | One BrowserWindow for all users | Multi-window manager with user context | Heavy |
| 3 | Electron Main | Global token cache | 🚨 Critical | Map shared across users | User-namespaced secure storage | Easy |
| 4 | Electron Main | Shared theme state | 🔴 High | Single currentTheme variable | Per-user theme in user context | Easy |
| 5 | Electron Main | Single voice agent process | 🔴 High | Global voiceAgentProcess | Per-user process pool | Very Heavy |
| 6 | Electron Main | Shared sandbox root | 🔴 High | agent-sandbox/ for all users | agent-sandbox-${userId}/ per user | Not Bad |
| 7 | Frontend | Global localStorage keys | 🚨 Critical | Same keys for all users | User-namespaced keys | Not Bad |
| 8 | Frontend | State overwrites on login | 🚨 Critical | New user overwrites previous | State isolation mechanism | Heavy |
| 9 | Frontend | No user context provider | 🔴 High | Stores assume single user | UserContextProvider at app root | Not Bad |
| 10 | Backend | No access control in persistence | 🔴 High | Missing user verification | Add user_id checks to all queries | Not Bad |
| 11 | Backend | Global environment config | 🔴 High | Shared DC_API_KEY, AGENT_MODEL | Per-tenant configuration | Heavy |
| 12 | Backend | No workspace isolation | 🔴 High | Shared file access | Virtualized filesystem per tenant | Heavy |
| 13 | Backend | Session ID collision risk | 🟡 Medium | Caller generates IDs | UUID generation with uniqueness check | Easy |
| 14 | Backend | No tenant context in agents | 🔴 High | Agent instances lack user_id | Add tenant_id to agent init | Not Bad |
| 15 | Database | No RLS policies enforced | 🔴 High | Manual user_id filtering | Implement Supabase RLS | Not Bad |
| 16 | Database | Shared Supabase project | 🟡 Medium | All tenants in one DB | Acceptable with RLS, or schema-per-tenant | Very Heavy |
| 17 | Database | Session filesystem structure | 🔴 High | Hardcoded "ron" user | User-scoped directories | Easy |
| 18 | Config | No tenant config table | 🔴 High | Missing infrastructure | Create tenant_config table + service | Not Bad |
| 19 | Config | Shared API keys | 🚨 Critical | Global PERPLEXITY_API_KEY | Per-tenant API key management | Heavy |
| 20 | Config | No tenant-aware logging | 🟡 Medium | Plain console.log | Structured logging with tenant context | Easy |
| 21 | Config | No feature flags | 🟡 Medium | Hard-coded features | Per-tenant feature flag system | Not Bad |
| 22 | Security | No audit trail | 🟡 Medium | Missing activity logging | Cross-tenant audit log table | Not Bad |
| 23 | Security | No usage tracking | 🟡 Medium | Can't attribute costs | Implement usage metrics per tenant | Heavy |
| 24 | Security | No quota enforcement | 🔴 High | Unlimited resource usage | Per-tenant rate limiting | Heavy |

**Total Issues**: 24
**Critical (🚨)**: 6
**High (🔴)**: 14
**Medium (🟡)**: 4

---

## Recommended Architecture Changes

### Phase 1: Foundation (Easiest Lift)
**Complexity**: Easy to Not Bad
**Estimated Effort**: 2-3 weeks

1. ✅ **User-Scoped Storage Keys**
   - Add userId prefix to all localStorage/sessionStorage keys
   - Implement storage namespace utility
   ```typescript
   const getUserStorageKey = (userId: string, key: string) => `${userId}:${key}`
   ```

2. ✅ **Refactor Session Directory Structure**
   - Change from `.sessions/session_ron-*` to `.sessions/${userId}/session-*`
   - Update session creation/loading logic

3. ✅ **Add Tenant Context to Backend**
   - Add `tenant_id` and `user_id` parameters to agent initialization
   - Pass user context through all persistence calls

4. ✅ **Implement Supabase RLS Policies**
   - Enable RLS on all tables
   - Add user-scoped SELECT, INSERT, UPDATE, DELETE policies
   - Test policy enforcement

5. ✅ **Create Tenant Config Table**
   ```sql
   CREATE TABLE tenant_config (
     tenant_id UUID PRIMARY KEY REFERENCES users(tenant_id),
     features JSONB DEFAULT '{}',
     limits JSONB DEFAULT '{}',
     billing JSONB DEFAULT '{}',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

6. ✅ **Add Tenant-Aware Logging**
   - Create structured logger with tenant context
   - Add tenant_id to all log statements

---

### Phase 2: Core Multi-Tenancy (Moderate Lift)
**Complexity**: Not Bad to Heavy
**Estimated Effort**: 4-6 weeks

7. ✅ **Remove Single-Instance Lock (Option A: Multi-Window)**
   ```typescript
   // Remove:
   // if (!app.requestSingleInstanceLock()) { app.quit() }

   // Implement window manager:
   class WindowManager {
     private windows = new Map<string, BrowserWindow>()

     createUserWindow(userId: string) {
       const window = new BrowserWindow({...})
       this.windows.set(userId, window)
       return window
     }

     getUserWindow(userId: string) {
       return this.windows.get(userId)
     }
   }
   ```

8. ✅ **Refactor Global State to User-Scoped**
   ```typescript
   // BEFORE: Global state
   let currentTheme: Theme = 'system'
   const cachedTokens = new Map<string, string>()

   // AFTER: User-scoped state
   class UserStateManager {
     private userStates = new Map<string, UserState>()

     getUserState(userId: string): UserState {
       if (!this.userStates.has(userId)) {
         this.userStates.set(userId, {
           theme: 'system',
           tokens: new Map(),
           preferences: {},
         })
       }
       return this.userStates.get(userId)!
     }
   }
   ```

9. ✅ **Implement Per-User Sandbox Directories**
   ```typescript
   function getSandboxRoot(userId: string): string {
     const userDataPath = app.getPath('userData')
     const userSandbox = join(userDataPath, 'sandboxes', userId)

     // Ensure directory exists and is isolated
     if (!fs.existsSync(userSandbox)) {
       fs.mkdirSync(userSandbox, { recursive: true, mode: 0o700 })
     }

     return userSandbox
   }
   ```

10. ✅ **Add Access Control to Backend**
    ```python
    # Add to SupabaseClient methods
    def verify_access(self, user_id: str, resource_id: str, resource_type: str):
        result = self.client.table(resource_type)\
            .select("user_id")\
            .eq("id", resource_id)\
            .single()\
            .execute()

        if not result.data or result.data["user_id"] != user_id:
            raise PermissionError(f"Access denied to {resource_type} {resource_id}")
    ```

11. ✅ **Create ConfigService for Multi-Tenant Settings**
    ```typescript
    class ConfigService {
      private cache = new Map<string, TenantConfig>()

      async getTenantConfig(tenantId: string): Promise<TenantConfig> {
        if (this.cache.has(tenantId)) {
          return this.cache.get(tenantId)!
        }

        const { data } = await supabase
          .from('tenant_config')
          .select('*')
          .eq('tenant_id', tenantId)
          .single()

        this.cache.set(tenantId, data)
        return data
      }
    }
    ```

12. ✅ **Implement Frontend User Context Provider**
    ```typescript
    interface UserContextValue {
      userId: string
      tenantId: string
      getStorageKey: (key: string) => string
      getUserData: <T>(key: string) => T | null
      setUserData: <T>(key: string, value: T) => void
    }

    const UserContext = createContext<UserContextValue>(null!)

    export function UserContextProvider({ children }) {
      const { user } = useAuthStore()

      const value = useMemo(() => ({
        userId: user.id,
        tenantId: user.tenant_id,
        getStorageKey: (key) => `${user.id}:${key}`,
        // ... storage methods
      }), [user])

      return <UserContext.Provider value={value}>{children}</UserContext.Provider>
    }
    ```

---

### Phase 3: Advanced Multi-Tenancy (Heaviest Lift)
**Complexity**: Heavy to Very Heavy
**Estimated Effort**: 8-12 weeks

13. ✅ **Per-User Process Isolation**
    ```typescript
    class ProcessManager {
      private userProcesses = new Map<string, ChildProcess>()

      startUserProcess(userId: string, command: string) {
        if (this.userProcesses.has(userId)) {
          this.stopUserProcess(userId)
        }

        const process = spawn(command, [], {
          env: { ...process.env, USER_ID: userId },
          cwd: getUserSandbox(userId),
        })

        this.userProcesses.set(userId, process)
        return process
      }

      stopUserProcess(userId: string) {
        const process = this.userProcesses.get(userId)
        if (process) {
          process.kill()
          this.userProcesses.delete(userId)
        }
      }
    }
    ```

14. ✅ **Tenant-Specific API Key Management**
    ```typescript
    // Database table
    CREATE TABLE tenant_api_keys (
      id UUID PRIMARY KEY,
      tenant_id UUID REFERENCES users(tenant_id),
      service TEXT NOT NULL,  -- 'perplexity', 'openai', etc.
      api_key_encrypted TEXT NOT NULL,
      usage_count INTEGER DEFAULT 0,
      quota_limit INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    // API Key Service
    class ApiKeyService {
      async getApiKey(tenantId: string, service: string): Promise<string> {
        const { data } = await supabase
          .from('tenant_api_keys')
          .select('api_key_encrypted')
          .eq('tenant_id', tenantId)
          .eq('service', service)
          .single()

        return this.decrypt(data.api_key_encrypted)
      }

      async trackUsage(tenantId: string, service: string) {
        await supabase.rpc('increment_api_usage', {
          tenant_id: tenantId,
          service_name: service
        })
      }
    }
    ```

15. ✅ **Workspace Virtualization**
    ```python
    class TenantWorkspace:
        def __init__(self, tenant_id: str, user_id: str):
            self.tenant_id = tenant_id
            self.user_id = user_id
            self.root = f"/workspaces/{tenant_id}/{user_id}"
            self._init_workspace()

        def _init_workspace(self):
            os.makedirs(self.root, exist_ok=True, mode=0o700)

            # Create isolated directories
            for subdir in ['data', 'temp', 'logs', 'cache']:
                os.makedirs(f"{self.root}/{subdir}", exist_ok=True)

        def resolve_path(self, path: str) -> str:
            abs_path = os.path.abspath(os.path.join(self.root, path))

            # Prevent path traversal
            if not abs_path.startswith(self.root):
                raise SecurityError(f"Path traversal detected: {path}")

            return abs_path

        def read_file(self, path: str) -> str:
            safe_path = self.resolve_path(path)
            with open(safe_path, 'r') as f:
                return f.read()

        def write_file(self, path: str, content: str):
            safe_path = self.resolve_path(path)
            with open(safe_path, 'w') as f:
                f.write(content)
    ```

16. ✅ **Usage Tracking & Billing**
    ```typescript
    // Database table
    CREATE TABLE usage_metrics (
      id UUID PRIMARY KEY,
      tenant_id UUID REFERENCES users(tenant_id),
      metric_type TEXT NOT NULL,  -- 'api_call', 'storage_gb', 'compute_seconds'
      metric_value NUMERIC,
      metadata JSONB,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );

    // Usage Tracking Service
    class UsageTracker {
      async track(tenantId: string, metricType: string, value: number, metadata?: any) {
        await supabase.from('usage_metrics').insert({
          tenant_id: tenantId,
          metric_type: metricType,
          metric_value: value,
          metadata: metadata || {}
        })

        // Check quotas
        await this.enforceQuota(tenantId, metricType)
      }

      async enforceQuota(tenantId: string, metricType: string) {
        const config = await configService.getTenantConfig(tenantId)
        const usage = await this.getUsageThisMonth(tenantId, metricType)
        const limit = config.limits[metricType]

        if (usage >= limit) {
          throw new QuotaExceededError(`Tenant ${tenantId} exceeded ${metricType} quota`)
        }
      }
    }
    ```

17. ✅ **Rate Limiting per Tenant**
    ```typescript
    class RateLimiter {
      private limits = new Map<string, { count: number; resetAt: Date }>()

      async checkLimit(tenantId: string, action: string): Promise<boolean> {
        const config = await configService.getTenantConfig(tenantId)
        const limit = config.limits[`${action}_per_minute`] || 60

        const key = `${tenantId}:${action}`
        const current = this.limits.get(key) || { count: 0, resetAt: new Date(Date.now() + 60000) }

        if (current.resetAt < new Date()) {
          current.count = 0
          current.resetAt = new Date(Date.now() + 60000)
        }

        if (current.count >= limit) {
          return false  // Rate limit exceeded
        }

        current.count++
        this.limits.set(key, current)
        return true
      }
    }
    ```

18. ✅ **Audit Trail System**
    ```sql
    CREATE TABLE audit_log (
      id UUID PRIMARY KEY,
      tenant_id UUID REFERENCES users(tenant_id),
      user_id UUID REFERENCES users(id),
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id UUID,
      metadata JSONB,
      ip_address INET,
      user_agent TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, timestamp DESC);
    CREATE INDEX idx_audit_user ON audit_log(user_id, timestamp DESC);
    ```

---

### Phase 4: Organization Multi-Tenancy (Future)
**Complexity**: Very Heavy
**Estimated Effort**: 12+ weeks

19. ✅ **Organization-Based Tenancy**
    - Expand from user-based to organization-based tenancy
    - Users can belong to multiple organizations
    - Organization admin roles and permissions
    - Shared resources within organization
    - Organization billing and quotas

20. ✅ **Multi-Tenant Admin Dashboard**
    - Self-service configuration UI
    - Usage analytics per tenant
    - Billing management
    - User management within tenant

---

## Implementation Roadmap

### Sprint 1-2: Critical Fixes (Easy)
**Goal**: Prevent immediate data conflicts between users

- [ ] Implement user-scoped localStorage keys
- [ ] Refactor session directory structure to user-based
- [ ] Add basic tenant context to logs
- [ ] Create tenant_config table in Supabase
- [ ] Implement Supabase RLS policies
- [ ] Add user_id verification to backend queries

**Deliverable**: Users can log in/out without data conflicts

---

### Sprint 3-5: Core Multi-Tenancy (Not Bad to Heavy)
**Goal**: Enable multiple users to use the app safely

- [ ] Implement UserContextProvider in frontend
- [ ] Refactor Zustand stores to use user context
- [ ] Create per-user sandbox directories
- [ ] Implement ProcessManager for per-user processes
- [ ] Add ConfigService for tenant-specific settings
- [ ] Remove single-instance lock OR implement multi-window manager
- [ ] Refactor global state to user-scoped state

**Deliverable**: Multiple users can safely use the app with isolated data

---

### Sprint 6-9: Advanced Features (Heavy to Very Heavy)
**Goal**: Production-ready multi-tenant architecture

- [ ] Implement workspace virtualization for agents
- [ ] Add tenant-specific API key management
- [ ] Build usage tracking and billing system
- [ ] Implement rate limiting per tenant
- [ ] Create audit trail system
- [ ] Add quota enforcement
- [ ] Build admin dashboard for tenant management

**Deliverable**: Scalable, secure, production-ready multi-tenant system

---

### Sprint 10+: Organization Features (Very Heavy)
**Goal**: Support organization-based tenancy

- [ ] Implement organization data model
- [ ] Add organization membership and roles
- [ ] Build organization admin features
- [ ] Implement shared resources within orgs
- [ ] Add organization billing
- [ ] Create organization management dashboard

**Deliverable**: Full organization multi-tenancy support

---

## Architecture Decision Records

### ADR-001: Multi-Tenancy Model
**Decision**: Use **User-Based Tenancy** (tenant_id = user_id) initially, with foundation for Organization-Based Tenancy

**Rationale**:
- Simplest model to implement
- Matches current database schema
- Easy migration path to organization tenancy
- Sufficient for MVP and early scaling

**Alternatives Considered**:
1. **Organization-Based** - More complex, better for B2B SaaS
2. **Schema-Per-Tenant** - Maximum isolation, very complex and expensive

---

### ADR-002: Database Isolation Strategy
**Decision**: Use **Row-Level Security (RLS)** in single Supabase project

**Rationale**:
- Cost-effective for early stage
- Simpler than schema-per-tenant or database-per-tenant
- Supabase has excellent RLS support
- Can migrate to stronger isolation later if needed

**Trade-offs**:
- Less isolation than schema/database-per-tenant
- Requires careful RLS policy implementation
- Shared connection pool across tenants

---

### ADR-003: Electron Architecture
**Decision**: **Multi-Window Architecture** with per-user window instances

**Rationale**:
- Maintains Electron's process isolation benefits
- Allows multiple users on same machine
- Each window has isolated renderer process
- IPC can route messages by user context

**Alternatives Considered**:
1. **Remove Electron** - Major rewrite, loses desktop features
2. **Single Window** - Cannot support multiple users simultaneously

---

### ADR-004: State Management
**Decision**: **User-Namespaced Storage** with UserContextProvider

**Rationale**:
- Minimal change to existing Zustand stores
- Leverages React Context API
- Clean separation of user data
- Easy to implement and test

---

### ADR-005: Backend Process Isolation
**Decision**: **Per-User Process Pool** with workspace virtualization

**Rationale**:
- Strong isolation between user workloads
- Prevents resource contention
- Enables per-user resource limits
- Allows graceful degradation under load

---

## Security Considerations

### Data Isolation
- ✅ Row-level security in database
- ✅ Per-user sandbox directories with path traversal prevention
- ✅ User-namespaced localStorage
- ✅ Process isolation per user
- ⚠️ Shared Supabase project - acceptable with proper RLS

### Authentication & Authorization
- ✅ Supabase Auth for authentication
- ⚠️ Need role-based access control (RBAC) within tenants
- ⚠️ Need session management improvements (concurrent sessions)
- ⚠️ Need MFA support for enterprise tenants

### API Keys & Secrets
- ⚠️ Currently shared across all users
- ❌ No per-tenant API key management
- ❌ No API key rotation
- ❌ No secrets encryption at rest

### Audit & Compliance
- ❌ No audit trail currently
- ❌ No data retention policies
- ❌ No GDPR/data deletion support
- ❌ No export user data functionality

---

## Testing Strategy

### Unit Tests Needed
- [ ] User-scoped storage utilities
- [ ] Path traversal prevention in sandbox
- [ ] RLS policy enforcement
- [ ] Access control checks in backend
- [ ] User context propagation

### Integration Tests Needed
- [ ] Multi-user login/logout flows
- [ ] Concurrent user sessions
- [ ] Data isolation between users
- [ ] Sandbox isolation between users
- [ ] Process cleanup on user logout

### Load Tests Needed
- [ ] 100 concurrent users
- [ ] 1000 concurrent sessions
- [ ] API rate limiting effectiveness
- [ ] Database query performance with RLS
- [ ] Memory usage per user

---

## Migration Plan

### Phase 1: Preparation (No Downtime)
1. Create new database tables:
   - `tenant_config`
   - `usage_metrics`
   - `audit_log`
   - `tenant_api_keys`

2. Add RLS policies to existing tables

3. Deploy backend changes (backwards compatible)

4. Deploy frontend changes with feature flag

### Phase 2: Enable Multi-Tenancy (Maintenance Window)
1. Enable feature flag for multi-tenant mode

2. Migrate existing sessions:
   ```bash
   # Rename session directories
   mv .sessions/session_ron-* .sessions/${ADMIN_USER_ID}/session-*
   ```

3. Migrate localStorage data:
   ```typescript
   // Run migration script in each user's context
   migrateUserStorage(oldKey, newKey)
   ```

4. Verify data integrity

5. Remove single-instance lock

### Phase 3: Validation
1. Test multi-user flows

2. Monitor for issues

3. Rollback plan ready

---

## Cost Implications

### Infrastructure Costs (Estimated)
- **Supabase**: $25-100/month (Pro plan for RLS, more storage)
- **API Keys per Tenant**: $10-50/tenant/month (Perplexity, OpenAI)
- **Compute**: Proportional to user count (minimal initial increase)
- **Storage**: $0.10/GB/month per tenant

### Development Costs
- **Phase 1 (Critical)**: 80-120 hours
- **Phase 2 (Core)**: 160-240 hours
- **Phase 3 (Advanced)**: 320-480 hours
- **Phase 4 (Organizations)**: 480+ hours

**Total Estimated**: 1040-1320+ hours

---

## Success Metrics

### Technical Metrics
- [ ] Zero data leakage incidents between tenants
- [ ] <100ms overhead per request for multi-tenant checks
- [ ] 99.9% uptime per tenant
- [ ] All RLS policies passing security audit
- [ ] <5% increase in infrastructure costs per new tenant

### User Metrics
- [ ] Multiple users can use the app simultaneously
- [ ] No data conflicts on user switch
- [ ] User isolation verified by security audit
- [ ] Tenant-specific configuration working
- [ ] Usage tracking accurate to ±1%

---

## Conclusion

Ron Browser requires **significant architectural refactoring** to support true multi-tenancy. The current single-user, single-instance architecture is fundamentally incompatible with multi-tenant requirements.

**Key Takeaways**:
1. **Electron main process** enforces single-instance operation - biggest blocker
2. **Frontend state management** needs user-scoped storage namespacing
3. **Backend agents** lack access control and tenant isolation
4. **Database layer** has the best foundation with user-scoped tables
5. **Configuration** infrastructure is minimal and needs significant expansion

**Recommended Approach**:
- Start with **Phase 1 (Easy)** fixes to prevent immediate data conflicts
- Progress to **Phase 2 (Moderate)** for core multi-tenancy support
- Invest in **Phase 3 (Heavy)** for production-ready scalability
- Consider **Phase 4 (Very Heavy)** only if targeting B2B/organization use cases

**Estimated Total Effort**: 4-6 months of focused development with 1-2 engineers

**Risk Assessment**: High complexity, but achievable with proper planning and phased rollout

---

## Appendix A: Code Locations Reference

### Critical Files for Multi-Tenant Refactoring

**Electron Main Process**:
- `electron/main.ts` - Lines 32-35 (single-instance lock), 37 (global window), 52 (token cache), 728-732 (voice agent)
- `electron/tool-manager.ts` - Tool execution context
- `electron/preload.ts` - IPC bridge

**Frontend**:
- `src/App.tsx` - Root component and routing
- `src/stores/authStore.ts` - Authentication state
- `src/stores/agentStore.ts` - Agent management
- `src/stores/taskStore.ts` - Task tracking
- `src/stores/userPreferencesStore.ts` - User preferences
- `src/stores/tabStore.ts` - Browser tabs

**Backend**:
- `agent/api/main.py` - Backend entry point
- `dist/agents/Ron/ron_dspy/persistence/supabase.py` - Persistence layer
- `agent/tools/strands-fun-tools/agent.py` - Agent implementation

**Database**:
- `src/types/supabase.ts` - Database schema types
- `src/api/supabase.ts` - Supabase client

**Configuration**:
- `.env` - Environment variables
- `package.json` - Build scripts
- `electron.vite.config.ts` - Build configuration

---

## Appendix B: Database Schema Additions

```sql
-- Tenant Configuration
CREATE TABLE tenant_config (
  tenant_id UUID PRIMARY KEY REFERENCES users(tenant_id),
  features JSONB DEFAULT '{}'::JSONB,
  limits JSONB DEFAULT '{}'::JSONB,
  billing JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Metrics
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(tenant_id),
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_tenant_time ON usage_metrics(tenant_id, timestamp DESC);
CREATE INDEX idx_usage_type ON usage_metrics(metric_type, timestamp DESC);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(tenant_id),
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);

-- Tenant API Keys
CREATE TABLE tenant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(tenant_id),
  service TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  quota_limit INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tenant_service ON tenant_api_keys(tenant_id, service);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Example for users table)
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Similar policies needed for all tables
```

---

**End of Report**

Generated using RLM (Recursive Language Model) pattern with 5 parallel analysis agents.
