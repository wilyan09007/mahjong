/**
 * The one Node global the tests use, declared by hand.
 *
 * Pulling in `@types/node` would put `fs`, `http` and friends in scope for a
 * package whose defining constraint is that it does no I/O. Declaring the
 * single thing we actually need keeps that boundary visible: if a future test
 * reaches for another Node API, it will not typecheck by accident.
 */
declare const process: { env: Record<string, string | undefined> };

/**
 * Just enough of `node:fs` for purity.test.ts to read the source tree. Tests
 * are allowed I/O; `src/` is not, which is the very thing that test checks.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function dirname(p: string): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
