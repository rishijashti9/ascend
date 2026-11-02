import { createBrowserRouter, RouterProvider } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';
import { buildRoutes } from './routes';

const router = createBrowserRouter(buildRoutes());

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
