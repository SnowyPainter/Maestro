
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RootLayout } from '@/components/Layouts/RootLayout';
import { LandingPage } from '@/pages/LandingPage/LandingPage';
import { LoginPage } from '@/pages/Auth/LoginPage';
import { SignupPage } from '@/pages/Auth/SignupPage';
import { ChatPage } from '@/pages/ChatPage/ChatPage';

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
        path: 'chat',
        element: <ChatPage />,
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
