import { Component, ReactNode } from "react";

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error("[ErrorBoundary]", error); }
  reset = () => { this.setState({ error: null }); };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center p-6">
          <div className="max-w-lg w-full glass rounded-3xl p-8 border border-red-500/40 bg-gradient-to-br from-red-500/10 to-transparent text-center">
            <h2 className="text-xl font-extrabold mb-2">Something went wrong</h2>
            <p className="text-xs font-mono text-muted-foreground break-all mb-4">{this.state.error.message}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => window.location.reload()} className="h-10 px-5 rounded-xl btn-primary-grad text-primary-foreground font-bold text-sm">
                Reload
              </button>
              <button onClick={this.reset} className="h-10 px-5 rounded-xl bg-card border border-border hover:border-primary text-sm font-semibold">
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
