// Sentry is loaded lazily and only when VITE_SENTRY_DSN is configured, so it
// stays out of the main bundle for deployments that don't use it.
type SentryModule = typeof import('@sentry/react')

let sentry: SentryModule | null = null

export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  sentry = await import('@sentry/react')
  sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  })
}

export function reportError(error: unknown): void {
  sentry?.captureException(error)
}
