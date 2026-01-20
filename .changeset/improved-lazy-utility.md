---
"@inox-tools/utils": minor
---

Improved Lazy utility with new features:

- Added circular dependency detection that throws a clear error when a Lazy value tries to access itself during initialization
- Implemented Promise interface (`then`, `catch`, `finally`) allowing Lazy instances to be awaited directly
- Added attachment system for side effects: `attach()` registers callbacks when values are computed, `chain()` creates derived Lazy instances
- Added static methods for working with multiple lazies: `attachMulti`, `chainMulti`, `attachAll`, `chainAll`
- Added new `LazyKeyed` class for managing keyed lazy values with per-key memoization, attachments, and chaining
