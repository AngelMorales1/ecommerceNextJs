/**
 * Constantes usadas por el middleware (rutas protegidas y roles).
 */

export const ADMIN_PATH_PREFIX = '/admin';
export const CHECKOUT_PATH_PREFIX = '/checkout';
export const API_ADMIN_PATH_PREFIX = '/api/admin';

export const VALID_ADMIN_ROLES = ['admin', 'super-user', 'SEO'] as const;
export type AdminRole = (typeof VALID_ADMIN_ROLES)[number];
