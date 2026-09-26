// Vite's import.meta.glob, used by tests to load fixtures without Node's file system.
interface ImportMeta {
  glob(
    pattern: string,
    options: { query: "?raw"; import: "default"; eager: true },
  ): Record<string, string>;
}

declare module "*?raw" {
  const text: string;
  export default text;
}
