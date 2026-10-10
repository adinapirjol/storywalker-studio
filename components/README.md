# Component organization

Group UI by the feature that owns its behavior. Routes and layouts in `app/`
compose these components; domain contracts, validation and server operations stay
in `lib/`. There is no root component barrel.

| Folder | Owns |
| --- | --- |
| `arena/` | Are.na reader, spatial field and source links |
| `body/` | BODY composition, playback, incoming preview and evidence review |
| `body/connections/` | Native transfer, pairing, batch timing and separately consented external feeds |
| `context/` | Context rehearsal and historical Health review entry point |
| `research/` | Research landing page, shared notebook and standalone experiments |
| `studio/` | Main workspace, onboarding, Atlas, Scenario Studio, Director, field trace and voice screens |
| `vault/` | Vault UI, Author review, shared access modal, sessions and passkeys |
| `xr/` | XR scene, journey renderers, evidence, sound and rehearsal controls |

## TypeScript and import conventions

- Use `.tsx` for JSX and `.ts` for hooks or other non-JSX modules. Keep existing
  kebab-case filenames, PascalCase component names and `use`-prefixed hook names.
- Keep component-only props/types beside their component. Share domain types from
  the owning `lib/` contract with `import type`; do not create a catch-all types
  directory or duplicate generated contracts.
- Colocate feature-specific hooks and CSS modules. For example,
  `vault/use-vault-passkeys.ts` belongs with the passkey UI. Shared styles stay
  inside their owning feature instead of being copied into each component.
- Use `./sibling` for files in the same folder and explicit
  `@/components/<feature>/<file>` paths across folders. Route imports use the
  same explicit paths. Avoid barrel files that obscure client/server boundaries
  or introduce import cycles.
- Preserve each file's `'use client'` boundary. Browser modules may import safe
  domain code and type-only contracts, never runtime Vault storage, credentials,
  validators or other server-only operations.
- Keep reusable feature UI with its owner even when another feature consumes it.
  Add a shared UI directory only when actual feature-independent primitives need
  it; do not use it as a miscellaneous folder.

Examples:

```ts
import { BodyComposition } from './body-composition';
import { NativeReceiver } from '@/components/body/connections/native-receiver';
import type { ContextState } from '@/lib/context/context-contract';
```

The folder reorganization changes import paths only. Component exports, rendering,
styles and the separate evidence/consent decisions remain unchanged. Existing
boundary tests scan this directory recursively.
