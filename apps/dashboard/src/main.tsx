import { lazy, StrictMode, Suspense, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { queryClient } from './lib/query';
import { DashboardLayout } from './routes/_layout';
import { t } from './strings/pt-BR';
import './styles.css';

const CalendarPage = lazyNamed(() => import('./routes/calendar'), 'CalendarPage');
const ClientsPage = lazyNamed(() => import('./routes/clients'), 'ClientsPage');
const DashboardPage = lazyNamed(() => import('./routes/dashboard'), 'DashboardPage');
const ForgotPasswordPage = lazyNamed(
  () => import('./routes/forgot-password'),
  'ForgotPasswordPage',
);
const LoginPage = lazyNamed(() => import('./routes/login'), 'LoginPage');
const PaymentsPage = lazyNamed(() => import('./routes/payments'), 'PaymentsPage');
const PublicBookingPage = lazyNamed(() => import('./routes/public-booking'), 'PublicBookingPage');
const ResetPasswordPage = lazyNamed(() => import('./routes/reset-password'), 'ResetPasswordPage');
const ServicesPage = lazyNamed(() => import('./routes/services'), 'ServicesPage');
const SettingsPage = lazyNamed(() => import('./routes/settings'), 'SettingsPage');
const SignUpDonePage = lazyNamed(() => import('./routes/signup/done'), 'SignUpDonePage');
const SignUpStep1Page = lazyNamed(() => import('./routes/signup/index'), 'SignUpStep1Page');
const SignUpStep2Page = lazyNamed(() => import('./routes/signup/shop'), 'SignUpStep2Page');
const StaffPage = lazyNamed(() => import('./routes/staff'), 'StaffPage');

function lazyNamed<T extends Record<string, ComponentType>>(
  loader: () => Promise<T>,
  exportName: keyof T,
) {
  return lazy(async () => ({ default: (await loader())[exportName] }));
}

function routeElement(Page: ComponentType) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[var(--color-text-muted)]">
          {t.common.loading}
        </div>
      }
    >
      <Page />
    </Suspense>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: routeElement(LoginPage) },
  { path: '/forgot-password', element: routeElement(ForgotPasswordPage) },
  { path: '/reset-password', element: routeElement(ResetPasswordPage) },
  { path: '/signup', element: routeElement(SignUpStep1Page) },
  { path: '/signup/shop', element: routeElement(SignUpStep2Page) },
  { path: '/signup/done', element: routeElement(SignUpDonePage) },
  { path: '/book/:slug', element: routeElement(PublicBookingPage) },
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { index: true, element: routeElement(DashboardPage) },
      { path: 'calendar', element: routeElement(CalendarPage) },
      { path: 'clients', element: routeElement(ClientsPage) },
      { path: 'services', element: routeElement(ServicesPage) },
      { path: 'staff', element: routeElement(StaffPage) },
      { path: 'payments', element: routeElement(PaymentsPage) },
      { path: 'settings', element: routeElement(SettingsPage) },
    ],
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
