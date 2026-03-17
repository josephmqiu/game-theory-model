/**
 * Error boundary — catches rendering errors and shows a fallback UI.
 */

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    this.setState({
      hasError: true,
      error,
      componentStack: info.componentStack ?? null,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 gap-3">
          <AlertTriangle size={32} className="text-red-500" />
          <h2 className="text-lg font-medium">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
          {this.state.componentStack && (
            <pre className="mt-2 max-h-48 max-w-2xl overflow-auto rounded border border-border bg-background p-3 text-left text-xs text-muted-foreground">
              {this.state.componentStack}
            </pre>
          )}
          <button
            type="button"
            onClick={() =>
              this.setState({
                hasError: false,
                error: null,
                componentStack: null,
              })
            }
            className="rounded px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
