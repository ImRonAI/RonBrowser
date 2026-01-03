---
name: pre-tool-standards
enabled: true
event: bash
pattern: .*
---

## 🔧 Pre-Execution Check

Before executing, confirm this action:
- Implements exactly what was requested (no extras)
- Uses standard approaches (no custom wrappers)
- Is production-ready (no stubs, mocks, or demos)
- Avoids unnecessary complexity

**Validation Requirements:**
- 🔍 Verify approach with **DeepWiki** and/or **WebFetch**
- ✅ Validate with **Context7**
- ❓ Questions/uncertainties → **Ask DeepWiki**
- ⚠️ Assumptions must be validated by **Ask DeepWiki**

**⚠️ Non-compliance will result in blocking hooks.**
