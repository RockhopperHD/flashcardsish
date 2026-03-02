import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown application error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[AppErrorBoundary] Unhandled error:', error);
    console.error('[AppErrorBoundary] Component stack:', info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleSafeReset = (): void => {
    const keysToClear = [
      'flashcard-library-v3',
      'flashcard-folders-v1',
      'flashcard-settings-v2',
      'flashcard-stats-v1',
      'flashcard-tags-v1',
      'flashcardsish-config-v2',
      'flashcardsish-structure-v2',
      'flashcardsish-v2-migrated',
    ];
    keysToClear.forEach(key => localStorage.removeItem(key));
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-panel border border-outline rounded-2xl p-6 shadow-xl">
          <h1 className="text-2xl font-bold mb-3">Flashcardsish hit an unexpected error</h1>
          <p className="text-sm text-muted mb-2">
            Your data is still in storage, but this screen crashed before rendering.
          </p>
          <p className="text-xs text-red mb-6 break-words">
            {this.state.errorMessage}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg border border-outline hover:border-accent font-bold text-sm transition-colors"
            >
              Reload App
            </button>
            <button
              onClick={this.handleSafeReset}
              className="px-4 py-2 rounded-lg bg-red text-white font-bold text-sm hover:bg-red/90 transition-colors"
            >
              Reset Local Cache
            </button>
          </div>
        </div>
      </div>
    );
  }
}
