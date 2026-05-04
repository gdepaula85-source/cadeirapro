import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { queryClient } from './lib/query';
import { DashboardLayout } from './routes/_layout';
import { DashboardPage } from './routes/dashboard';
import { LoginPage } from './routes/login';
import { SignUpStep1Page } from './routes/signup/index';
import { SignUpStep2Page } from './routes/signup/shop';
import { SignUpDonePage } from './routes/signup/done';
import './styles.css';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignUpStep1Page /> },
  { path: '/signup/shop', element: <SignUpStep2Page /> },
  { path: '/signup/done', element: <SignUpDonePage /> },
  {
    path: '/',
    element: <DashboardLayout />,
    children: [{ index: true, element: <DashboardPage /> }],
  },
]);

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element missing');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
