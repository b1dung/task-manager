import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
    this.props.onError?.(error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-base font-semibold text-fg">Đã xảy ra lỗi</h2>
          <p className="text-sm text-fg-muted max-w-sm">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors"
          >
            Thử lại
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
) {
  return function Wrapped(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
