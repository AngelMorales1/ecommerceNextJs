import { ADMIN_PATH_PREFIX, API_ADMIN_PATH_PREFIX, CHECKOUT_PATH_PREFIX } from './constants';

/** Rutas del panel admin (páginas), no incluye /api/admin */
export function isAdminPagePath(pathname: string): boolean {
  return pathname.startsWith(ADMIN_PATH_PREFIX) && !pathname.startsWith(API_ADMIN_PATH_PREFIX);
}

/** Rutas de checkout */
export function isCheckoutPath(pathname: string): boolean {
  return pathname.startsWith(CHECKOUT_PATH_PREFIX);
}

/** Rutas de API admin */
export function isApiAdminPath(pathname: string): boolean {
  return pathname.startsWith(API_ADMIN_PATH_PREFIX);
}

/** Indica si la ruta requiere algún tipo de protección (sesión y/o rol) */
export function isProtectedPath(pathname: string): boolean {
  return isAdminPagePath(pathname) || isCheckoutPath(pathname) || isApiAdminPath(pathname);
}
