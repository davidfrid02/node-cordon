#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';

interface CordonConfig {
  permissions: {
    fs?: { read?: string[]; write?: string[]; };
    net?: string[];
    worker?: boolean;
    'child-process'?: boolean;
    wasi?: boolean;
    inspector?: boolean;
  };
}

// 1. Load Configuration
const configPath = resolve(process.cwd(), 'cordon.config.json');

if (!existsSync(configPath)) {
  console.error(`[cordon] Error: cordon.config.json not found in ${process.cwd()}`);
  process.exit(1);
}

const config: CordonConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

// 2. Identify Target Script
const [, , command, targetScript] = process.argv;

if (command !== 'run' || !targetScript) {
  console.log('Usage: cordon run <script.ts|js>');
  process.exit(1);
}

// 3. Build Flags Array
const flags: string[] = ['--permission'];

const isTypeScript = targetScript.endsWith('.ts') || targetScript.endsWith('.tsx');

// Automatic TypeScript support via tsx ESM loader.
// tsx requires --allow-worker because its ESM hooks run inside a worker thread (Node v25+).
if (isTypeScript) {
  flags.push('--import', 'tsx/esm');
  flags.push('--allow-worker');
}

// Boolean capability flags from config
if (config.permissions.worker && !isTypeScript) flags.push('--allow-worker');
if (config.permissions['child-process'])         flags.push('--allow-child-process');
if (config.permissions.wasi)                     flags.push('--allow-wasi');
if (config.permissions.inspector)                flags.push('--allow-inspector');

// 4. Map File System Permissions
// Node's permission model requires a trailing slash on directories for recursive access.
const asReadPath = (p: string): string => {
  try {
    return statSync(p).isDirectory() ? `${p}/` : p;
  } catch {
    return p;
  }
};

// Always allow:
//   - node_modules (for tsx loader and all package imports)
//   - The Node.js executable directory (for internal ESM resolution)
//   - The entry script itself
//   - OS temp dir (tsx stores its transpile cache there)
const nodeModulesPath = resolve(process.cwd(), 'node_modules');
const nodeExecDir = dirname(process.execPath);
const scriptPath = resolve(process.cwd(), targetScript);

const readPaths = new Set<string>([
  asReadPath(nodeModulesPath),
  asReadPath(nodeExecDir),
  scriptPath,
  // tsx needs: temp dir (transpile cache) + CWD (tsconfig.json lookup)
  ...(isTypeScript ? [`${tmpdir()}/`, process.cwd()] : []),
]);

if (config.permissions.fs?.read) {
  for (const p of config.permissions.fs.read) {
    readPaths.add(asReadPath(resolve(process.cwd(), p)));
  }
}

for (const p of readPaths) {
  flags.push(`--allow-fs-read=${p}`);
}

// tsx needs write access to the OS temp dir to store its transpile cache
const writePaths = new Set<string>(
  isTypeScript ? [`${tmpdir()}/`] : []
);

if (config.permissions.fs?.write?.length) {
  for (const p of config.permissions.fs.write) {
    writePaths.add(asReadPath(resolve(process.cwd(), p)));
  }
}

for (const p of writePaths) {
  flags.push(`--allow-fs-write=${p}`);
}

// 5. Map Network Permissions
if (config.permissions.net?.length) {
  for (const host of config.permissions.net) {
    flags.push(`--allow-net=${host}`);
  }
}

console.log(`[cordon] Runtime isolation active for: ${targetScript}`);
console.log(`[cordon] Flags: ${flags.join(' ')}`);

// 6. Spawn child process with permission flags
const child = spawn(process.execPath, [...flags, targetScript], {
  stdio: 'inherit',
  shell: false,
});

child.on('error', (err) => {
  console.error(`[cordon] Failed to start process: ${err.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});