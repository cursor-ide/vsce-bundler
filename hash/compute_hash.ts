/**
 * Hash utilities for computing content hashes of VS Code extensions.
 * 
 * @module
 */

import { join } from "@std/path";
import { walk } from "@std/fs";

/** 
 * Compute a hex-encoded SHA-256 digest for arbitrary bytes.
 * 
 * @param data The binary data to hash
 * @returns A hex-encoded SHA-256 hash string
 * @internal
 */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute a project hash by hashing all `*.ts`, `*.tsx`, and `*.json` files
 * under `projectDir`, excluding the generated `outDir`.
 */
export async function computeProjectHash(
  projectDir: string,
  outDir: string,
): Promise<string> {
  const outPath = join(projectDir, outDir);
  const fileHashes: string[] = [];
  for await (const entry of walk(projectDir, { includeDirs: false })) {
    if (entry.path.startsWith(outPath)) continue;
    if (!entry.path.match(/\.(ts|tsx|json)$/)) continue;
    const content = await Deno.readFile(entry.path);
    fileHashes.push(await sha256Hex(content));
  }
  const combined = new TextEncoder().encode(fileHashes.sort().join(""));
  return sha256Hex(combined);
}
