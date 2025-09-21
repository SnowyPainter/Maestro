
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from '@/components/Layouts/RootLayout';
import { LandingPage } from '@/pages/LandingPage/LandingPage';
import { LoginPage } from '@/pages/Auth/LoginPage';
import { SignupPage } from '@/pages/Auth/SignupPage';
import { ChatPage } from '@/pages/ChatPage/ChatPage';

import { SettingsPage } from "./pages/SettingsPage/SettingsPage";
import { ControlTowerPage } from "./pages/ControlTowerPage/ControlTowerPage";
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { DataDeletionPolicyPage } from './pages/DataDeletionPolicyPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';


import { ProtectedRoute } from '@/components/Auth/ProtectedRoute';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'signup',
        element: <SignupPage />,
      },
      {
        path: 'privacy-policy',
        element: <PrivacyPolicyPage />,
      },
      {
        path: 'data-deletion-policy',
        element: <DataDeletionPolicyPage />,
      },
      {
        path: 'terms-of-service',
        element: <TermsOfServicePage />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'chat',
            element: <ChatPage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
          {
            path: 'control-tower',
            element: <ControlTowerPage />,
          },
        ]
      }
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
