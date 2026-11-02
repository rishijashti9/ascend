import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { logError } from '@/core/errorLog';
import { ErrorScreen } from './ErrorScreen';

/** Catches render errors anywhere below it (outside the router). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const where = info.componentStack?.trim().split('\n')[0];
    logError(error, where ? `render: ${where}` : 'render');
  }

  render() {
    if (this.state.error) return <ErrorScreen message={this.state.error.message} />;
    return this.props.children;
  }
}

function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Router-level error element (errors thrown inside routes). */
export function RouteErrorScreen() {
  const error = useRouteError();
  useEffect(() => {
    logError(error instanceof Error ? error : describe(error), 'route');
  }, [error]);
  return <ErrorScreen message={describe(error)} />;
}
