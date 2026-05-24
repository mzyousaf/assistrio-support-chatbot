import { Navigate, useLocation } from 'react-router-dom';

/** Append the current location search string to a relative or absolute in-app path. */
export function appendSearchToPath(path: string, search: string): string {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) return path;
  if (path.includes('?')) return path;
  return `${path}${trimmedSearch.startsWith('?') ? trimmedSearch : `?${trimmedSearch.slice(1)}`}`;
}

/** React Router redirect that keeps `?showInstall=1` and other query params across index redirects. */
export function PreserveSearchNavigate({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={appendSearchToPath(to, location.search)} replace />;
}
