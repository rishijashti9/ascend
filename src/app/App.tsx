import { createBrowserRouter, RouterProvider } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';
import { buildRoutes } from './routes';
import { UpdatePrompt } from './UpdatePrompt';

const router = createBrowserRouter(buildRoutes());

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </ErrorBoundary>
  );
}
