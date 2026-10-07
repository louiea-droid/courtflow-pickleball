import { Component } from "react";

// Without this, a crash anywhere unmounts the whole app and leaves a blank page. It shows what
// went wrong instead, with a way to reload or go home.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("CourtFlow crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="loading" role="alert">
        <b>Something went wrong.</b>
        <span>{String(this.state.error?.message || this.state.error)}</span>
        <button className="primary" onClick={() => window.location.reload()}>Reload this page</button>
        <a className="outline back-link" href="/">Go to home</a>
      </div>
    );
  }
}
