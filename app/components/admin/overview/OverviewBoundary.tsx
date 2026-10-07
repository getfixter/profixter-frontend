"use client";

/**
 * The last line of defence for the Overview. lib/admin-overview.ts already
 * fills every response to the shape the components read; if something still
 * throws while rendering, only this tab shows a message. The admin header,
 * the other tabs and the bottom navigation keep working.
 */

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class OverviewBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Overview failed to render", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-[15px] text-slate-600">Overview couldn&apos;t be shown. The other tabs still work.</p>
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className="mt-4 h-10 rounded-full bg-slate-900 px-5 text-[14px] font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }
}
