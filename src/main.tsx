import { BrowserRouter } from 'react-router-dom';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import './styles/variables.css'
import './styles/buttons.css'
import './styles/forms.css'
import './styles/layout.css'
import './styles/pageStyles'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import { installGlobalErrorHandlers } from './lib/globalErrors'
import NoticeHost from './components/NoticeHost/NoticeHost'

installGlobalErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
      {/* Outside the boundary so popups still work if a page crashes. */}
      <NoticeHost />
    </QueryClientProvider>
  </StrictMode>,
)
