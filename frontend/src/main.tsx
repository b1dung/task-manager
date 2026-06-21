import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import './i18n'
import App from './App.tsx'
import { queryClient } from './lib/queryClient'
import { initSentry } from './lib/sentry'

void initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* React Query Devtools — bật lại bằng cách bỏ comment dòng dưới (và dòng import ở trên) */}
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  </StrictMode>,
)
