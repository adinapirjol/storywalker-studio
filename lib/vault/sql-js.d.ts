declare module "sql.js/dist/sql-asm.js" {
  export type SqlStatement = {
    bind(values?: unknown[]): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  };
  export type SqlDatabase = {
    run(sql: string, values?: unknown[]): void;
    prepare(sql: string): SqlStatement;
    export(): Uint8Array;
    close(): void;
  };
  const initialise: (config?: { locateFile?: (file: string) => string }) => Promise<{ Database: new (data?: Uint8Array) => SqlDatabase }>;
  export default initialise;
}

declare module "sql.js/dist/sql-wasm.js" {
  export type SqlStatement = {
    bind(values?: unknown[]): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  };
  export type SqlDatabase = {
    run(sql: string, values?: unknown[]): void;
    prepare(sql: string): SqlStatement;
    export(): Uint8Array;
    close(): void;
  };
  const initialise: (config?: { locateFile?: (file: string) => string }) => Promise<{ Database: new (data?: Uint8Array) => SqlDatabase }>;
  export default initialise;
}
