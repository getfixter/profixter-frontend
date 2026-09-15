"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Keeps a WebGL or loader failure inside the canvas panel.
 *
 * Without this, a missing GLB or a lost context takes the whole route down and
 * the Lab becomes a blank screen with no way to read the error. The controls
 * are more useful than the canvas when something is wrong.
 */
export default class LabErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[Fixter Lab] scene error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-white p-6 text-center">
          <p className="text-sm font-bold text-slate-800">
            The 3D scene failed to start.
          </p>
          <p className="max-w-md font-mono text-[11px] text-slate-500">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
