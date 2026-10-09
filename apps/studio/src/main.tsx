import { Component, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

/** A rendering error shows what happened and a way back, not a blank page. */
class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-xl space-y-3 p-8 text-sm">
        <p className="font-semibold">Studio stopped showing this page.</p>
        <pre className="whitespace-pre-wrap text-red-700">{this.state.error.message}</pre>
        <p>Your app and its changes are saved. Reloading shows them again.</p>
        <button
          type="button"
          className="rounded-md bg-fg px-3 py-1.5 text-panel"
          onClick={() => location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
);
