import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { PrimeReactProvider } from 'primereact/api';
import 'primeicons/primeicons.css';
import HomePage from './pages/HomePage';

let router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
]);



const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <PrimeReactProvider>
      <RouterProvider router={router} />
    </PrimeReactProvider>
  </StrictMode>,
);