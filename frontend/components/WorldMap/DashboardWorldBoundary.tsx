"use client";

import { Component, type ReactNode } from "react";

type DashboardWorldBoundaryProps = {
  children: ReactNode;
  onNavigate: (href: string) => void;
  resetKey: string;
};

type DashboardWorldBoundaryState = {
  failed: boolean;
};

export default class DashboardWorldBoundary extends Component<DashboardWorldBoundaryProps, DashboardWorldBoundaryState> {
  state: DashboardWorldBoundaryState = { failed: false };

  static getDerivedStateFromError(): DashboardWorldBoundaryState {
    return { failed: true };
  }

  componentDidUpdate(previous: DashboardWorldBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return <section className="dashboard-world-fallback" role="alert">
      <div>
        <span>SURI KINGDOM</span>
        <h1>The interactive map is unavailable.</h1>
        <p>Your learning tools still work. Choose a destination below, or retry the map.</p>
        <nav aria-label="Dashboard destinations">
          <button type="button" data-tutorial="fallback-history" onClick={() => this.props.onNavigate("/history-logs")}>History Logs</button>
          <button type="button" data-tutorial="fallback-topics" onClick={() => this.props.onNavigate("/topics")}>Topics</button>
          <button type="button" data-tutorial="fallback-progress" onClick={() => this.props.onNavigate("/progress")}>Progress &amp; mistake review</button>
          <button type="button" data-tutorial="fallback-calculator" onClick={() => this.props.onNavigate("/calculator")}>Calculator</button>
          <button type="button" data-tutorial="fallback-playground" onClick={() => this.props.onNavigate("/playground")}>Playground</button>
        </nav>
        <button type="button" className="dashboard-world-retry" onClick={() => this.setState({ failed: false })}>Retry map</button>
      </div>
    </section>;
  }
}
