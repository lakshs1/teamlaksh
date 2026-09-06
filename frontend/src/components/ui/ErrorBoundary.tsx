import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from './Button';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={styles.errorContainer}>
          <h2 className={styles.title}>Something went wrong</h2>
          <p className={styles.message}>
            An unexpected application error occurred. You can reload the page to restore state.
          </p>
          <div className={styles.actions}>
            <Button onClick={this.handleReset}>Reload Page</Button>
            <Button variant="outline" onClick={() => (window.location.href = '/')}>
              Go to Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
