# node-cordon

**Runtime permission management for Node.js 24+.**

`node-cordon` is a developer-friendly orchestrator for the native Node.js Permission Model. It replaces complex CLI flag strings with a declarative `cordon.config.json` and a type-safe API, allowing you to lock down exactly what your application and its dependencies are allowed to touch.

[![NPM Version](https://img.shields.io/npm/v/node-cordon.svg)](https://www.npmjs.com/package/node-cordon)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

---

## Why node-cordon?

Node.js 24+ ships a native Permission Model, but managing it manually means maintaining long, fragile CLI strings. `node-cordon` brings order to that.

- **Declarative security:** Define permissions in `cordon.config.json` instead of inline bash flags.
- **Supply chain defense:** Prevent malicious npm packages from reading your `.env` or calling unknown servers.
- **Graceful degradation:** Use `Cordon.shield` to handle denials with a typed fallback instead of a process crash.
- **Zero dependencies:** Built entirely on native Node.js APIs.

---

## Installation

```bash
npm install node-cordon
```

---

## Usage

### 1. Create `cordon.config.json`

Define exactly what your application is allowed to access.

```json
{
  "permissions": {
    "fs": {
      "read": ["./dist", "./node_modules"],
      "write": ["./logs"]
    },
    "net": ["api.stripe.com", "localhost:5432"]
  }
}
```

### 2. Build your app

The CLI runs compiled JavaScript. Build your project before running with cordon.

```bash
npm run build
```

### 3. Run with the CLI

```bash
npx cordon run dist/index.js
```

cordon reads `cordon.config.json`, translates it into the appropriate `--permission` flags, and spawns your app in an isolated process.

---

## Programmatic API

Use `Cordon.shield` inside your application to handle permission denials gracefully:

```typescript
import { Cordon } from 'node-cordon';

// Executes the action if permitted, returns the fallback if denied
const config = await Cordon.shield(
  'fs.read',
  './config/database.json',
  () => readConfig(),
  { host: 'localhost', port: 5432 }
);
```

Use `Cordon.has` to check a permission directly:

```typescript
if (Cordon.has('net', 'api.stripe.com')) {
  // safe to make the request
}
```

When the permission model is not active (e.g. during local development without the `--permission` flag), both methods default to allowing all operations.

---

## Configuration reference

```json
{
  "permissions": {
    "fs": {
      "read": ["./dist", "./node_modules"],
      "write": ["./tmp"]
    },
    "net": ["api.example.com", "localhost:3000"],
    "worker": true,
    "child-process": true,
    "wasi": true,
    "inspector": true
  }
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `permissions.fs.read` | `string[]` | Paths the process may read |
| `permissions.fs.write` | `string[]` | Paths the process may write |
| `permissions.net` | `string[]` | Hosts the process may connect to |
| `permissions.worker` | `boolean` | Allow worker thread creation |
| `permissions.child-process` | `boolean` | Allow `spawn`, `exec`, and `fork` |
| `permissions.wasi` | `boolean` | Allow WASI system interface access |
| `permissions.inspector` | `boolean` | Allow the Node.js debugger/inspector |

Paths are resolved relative to the working directory where `cordon` is invoked.

---

## Comparison

| Feature | Standard Node.js | node-cordon |
| :--- | :--- | :--- |
| Configuration | Manual `--permission` CLI flags | `cordon.config.json` |
| Developer experience | Hard to maintain | Version-controlled and readable |
| Permission denials | Process crash | Graceful fallback via `Cordon.shield` |
| Dependency isolation | Manual, easy to forget | Automatic on every run |

---

## Requirements

- **Node.js v24** or higher (uses the stable `--permission` flag introduced in v24).

---

## License

MIT © 2026
