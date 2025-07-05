# `@vsce/bundler`

> A Deno-native bundler for VSCode extensions - optimized for JSR

[![JSR Scope](https://jsr.io/badges/@vsce)](https://jsr.io/@vsce)
[![JSR](https://jsr.io/badges/@vsce/bundler)](https://jsr.io/@vsce/bundler)
[![JSR Score](https://jsr.io/badges/@vsce/bundler/score)](https://jsr.io/@vsce/bundler/score)
[![GitHub CI](https://img.shields.io/github/actions/workflow/status/cursor-ide/vsce-bundler/bundler.yml?branch=main&label=sync)](https://github.com/cursor-ide/vsce-bundler/actions/workflows/bundler.yml)
[![Last Updated](https://img.shields.io/github/last-commit/cursor-ide/vsce-bundler?label=last%20synced)](https://github.com/cursor-ide/vsce-bundler/commits/main)
[![License](https://img.shields.io/github/license/cursor-ide/vsce-bundler)](https://github.com/cursor-ide/vsce-bundler/blob/main/LICENSE)

`@vsce/bundler` is a **zero-configuration**, **Deno-native** bundler for building modern VS Code extensions and publishing them on the [JSR](https://jsr.io) registry. It wraps Deno’s native `@deno/emit` pipeline with smart defaults—minification, cache-aware incremental builds, and detailed diagnostics—while keeping the resulting bundle fully ESM-compatible and Web-extension-ready.

## Features

| Category            | Details |
|---------------------|---------|
| 🦕 **Deno-Native**        | Built entirely with the Deno runtime—no Node.js toolchain required. |
| 📦 **Single-file Bundle**  | Produces an optimized `extension.js` suitable for both Desktop **and** Web-Worker targets. |
| ⚡ **Incremental Cache**  | Hash-based cache detects unchanged source trees and returns instantly. |
| 🔧 **Minification**       | Optional minification via **esbuild** (default) or **terser**. Source-maps included. |
| 🗣️ **Verbose / Quiet**    | Toggle diagnostic output for CI or local dev. |
| 🔌 **Pluggable**          | Inject a custom `bundleFn`—perfect for unit tests or experimental compilers. |
| 🛡️ **Web Compatibility Audit** | Static analysis to flag Node-specific APIs before you publish. |
| ✅ **Type-Safe API**      | Full Strict-Mode TypeScript definitions—no `any` types. |

---

## Installation

### Using JSR (**Recommended**)

```bash
# Add to your import map (deno.json / import_map.json)
{
  "imports": {
    "@vsce/bundler/": "jsr:@vsce/bundler@^1/"
  }
}
```

### Direct URL (pinned version)

```ts
import { bundleExtension } from "https://jsr.io/@vsce/bundler@1.0.0/mod.ts";
```

> ℹ️ `@vsce/bundler` targets **Deno ≥1.44** and **JSR ≥1**.

---

## Quick Start

```ts
import { bundleExtension } from "@vsce/bundler";

const result = await bundleExtension({
  projectDir: Deno.cwd(),   // root of your extension project
  verbose: true,            // show build diagnostics
  minify: true,             // produce a minified bundle + source-map
});

console.log(`Bundle written to ${result.bundlePath}`);
```

The resulting directory structure:

```
my-extension/
├── extension.ts   # your entry point
├── package.json   # VS Code manifest
└── out/
    ├── extension.js      # bundled output
    └── extension.js.map  # source-map (if minify=true)
```

---

## API Reference

### `bundleExtension`

```ts
async function bundleExtension(options: BundleOptions): Promise<BundleResult>;
```

| Option              | Type                                    | Default           | Description |
|---------------------|-----------------------------------------|-------------------|-------------|
| `projectDir`        | `string` (absolute)                     | **required**      | Root folder that contains `extension.ts`, `package.json`, etc. |
| `entryPoint`        | `string`                                | `"extension.ts"` | Relative path inside `projectDir`. |
| `outDir`            | `string`                                | `"out"`          | Folder for generated bundle. |
| `outFile`           | `string`                                | `"extension.js"` | Name of the bundle file. |
| `minify`            | `boolean`                               | `false`           | Enable minification. |
| `minifier`          | `"esbuild" \| "terser"`            | `"esbuild"`       | Engine used when `minify=true`. |
| `useCache`          | `boolean`                               | `true`            | Skip rebuild if project hash has not changed. |
| `verbose`           | `boolean`                               | `false`           | Print diagnostic and timing information. |
| `quiet`             | `boolean`                               | `false`           | Suppress all non-error output (overrides `verbose`). |
| `log` / `logError`  | `(msg: string) => void`                 | `console.log` / `console.error` | Custom log sinks (useful for tests). |
| `bundleFn`          | `typeof import("@deno/emit").bundle`   | `@deno/emit.bundle` | Inject a custom bundler implementation. |

`BundleResult` structure:

```ts
type BundleResult = {
  bundlePath: string;     // absolute path to extension.js
  size: number;           // size in bytes
  buildTimeMs: number;    // 0 if cache hit
  fromCache: boolean;     // true if no rebuild occurred
  messages: string[];     // emitted log messages (respecting quiet/verbose)
};
```

### `validateWebCompatibility`

```ts
async function validateWebCompatibility(entryPoint: string): Promise<string[]>;
```

Runs a **static analysis audit** over your source tree:

* Flags imports or requires of **Node builtin** modules (`fs`, `path`, …).
* Flags usage of the `Deno.*` namespace (not allowed in Web extensions).

Returns an **array of issues**. An empty array means your extension is safe to ship as a browser-sandboxed VS Code Web extension.

---

## CLI Usage

`@vsce/bundler` is a support package consumed automatically by the `@vsce/cli` project:

```bash
vsce build      # bundles + packages your extension
vsce build --no-cache --minify --verbose
```

However, you can invoke the Deno module directly:

```bash
deno run -A jsr:@vsce/bundler@^1/cli.ts ./path/to/extension
```

---

## Advanced Topics

### Custom Minifier Example

```ts
import { bundleExtension } from "@vsce/bundler";
import { bundle } from "jsr:@deno/emit";

const res = await bundleExtension({
  projectDir: "/my/ext",
  minify: true,
  minifier: "terser", // switch to terser
  bundleFn: bundle,   // still can swap bundler if needed
});
```

### Testing Strategy

All production tests use a **fake bundle function** to avoid heavy I/O. Pass a stub via `bundleFn`—the API contract only requires `{ code: string; map: string }` in the resolve value.

### Performance Tips

1. **Cache** is SHA-256 over all `*.ts/tsx/json` files (excluding `outDir`). Keep large assets outside your source tree.
2. **Incremental builds**: On average ➜ sub-100 ms rebuilds on unchanged projects.
3. **Minification**: `esbuild` (~5× faster) vs `terser` (smaller bundles). Pick based on CI constraints.

---

### Web Extension Support

#### Why Web Extensions?

This package is optimized for the **VSCode Web Extensions** runtime as our **pragmatic path to bringing VSCode extension development to Deno**. While our ideal would be full parity with the Node.js extension development environment, the web extension runtime represents the best available approach given current VSCode architecture limitations.

**The Reality:**

* 🎯 **Goal**: Enable Deno-native VSCode extension development
* ⚠️ **Challenge**: VSCode's extension host is deeply integrated with Node.js
* ✅ **Solution**: Leverage the web extension runtime for Deno compatibility
* 🪄 **Future**: Working toward fuller Node.js runtime parity as the ecosystem evolves

#### Universal Compatibility

The web extension runtime enables you to create extensions that run **everywhere** - both desktop VSCode and web-based environments (vscode.dev, github.dev, GitHub Codespaces):

```typescript
import * as vscode from "@typed/vscode";

// Web extensions run on BOTH desktop and web VSCode
export function activate(context: vscode.ExtensionContext): void {
  // Full VSCode API support: TreeView, Commands, Language Features, etc.
  const provider = new MyTreeDataProvider();
  vscode.window.createTreeView('myView', { treeDataProvider: provider });
  
  // Limitation: Node.js APIs are not available (browser sandbox restrictions)
  // But the extension works identically on desktop and web!
}
```

**Key Benefits:**

* ✅ **Universal compatibility** - One extension runs on desktop AND web VSCode
* ✅ **Full VSCode API access** - Commands, UI, language features, etc.
* ✅ **Modern deployment** - Works in vscode.dev, github.dev, Codespaces
* ⚠️ **Browser limitations** - No Node.js/filesystem APIs (applies to web runtime only)

### 🚧 Deno VSCode Extension Ecosystem (WIP) 🚧

`@vsce/bundler` is part of a complete ecosystem for Deno-based VSCode extension development. Explore these complementary packages:

### 🛠️ Development Tools

**[@typed/vscode](https://jsr.io/@typed/vscode)** - TypeScript definitions for VSCode APIs

```bash
deno add @typed/vscode
```

**[@vsce/cli](https://jsr.io/@vsce/cli)** - Command-line tools for Deno VSCode extensions

```bash
deno add @vsce/cli
```

* Project scaffolding and templates
* Development server with hot reload  
* Build and packaging utilities
* Extension testing and validation

**[@vsce/create](https://jsr.io/@vsce/create)** - Project generator for new extensions

```bash
deno add @vsce/create
```

* Interactive project setup
* Multiple template options (basic, language server, tree view, etc.)
* Deno-optimized project structure
* Best practices and conventions built-in

### 🧪 Testing Framework

**[@vsce/testing](https://jsr.io/@vsce/testing)** - Testing utilities for VSCode extensions

```bash
deno add @vsce/testing
```

* Mock VSCode APIs for unit testing
* Extension host simulation
* Language server testing utilities
* TreeView and UI component testing

## Runtime Compatibility

| Environment | Support | Notes |
|-------------|---------|-------|
| **VSCode Desktop** | ✅ Full | All APIs available |
| **VSCode Web** | ✅ Most APIs | No Node.js/filesystem APIs |
| **Deno Runtime** | ✅ Type-checking | For development and testing |
| **GitHub Codespaces** | ✅ Full | Web + server APIs |
| **vscode.dev** | ✅ Web APIs | Browser-based development |

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Happy coding with Deno + VSCode! 🦕⚡**

*Part of the [@vsce ecosystem](https://jsr.io/@vsce) for Deno-based VSCode extension development.*
