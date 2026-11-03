import { LookEditor, type LookEditorHost } from "@smithable/look-editor";

const host: LookEditorHost = {
  kind: import.meta.env.VITE_THEME_LAB === "public" ? "public" : "local",
  request: (path, init) => fetch(path, init),
};
export function App() {
  return <LookEditor host={host} />;
}
