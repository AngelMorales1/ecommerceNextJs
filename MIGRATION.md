# Migración Next.js 12 → 15 — Teslo Shop

Documento de todo lo que falta por hacer para completar la migración del proyecto hasta Next.js 15.

---

## 1. Estado actual

| Dependencia        | Versión actual | Notas                          |
|--------------------|----------------|--------------------------------|
| next               | 13             | Objetivo: 15                   |
| react / react-dom   | ^19.2.4        | OK para Next 15                |
| next-auth          | ^4.2.1         | Opcional migrar a v5 (Auth.js) |
| typescript         | 4.5.5          | Actualizar a 5.x               |
| eslint-config-next | 13             | Debe coincidir con Next        |
| @types/node        | 17.0.17        | Actualizar (ej. 20.x)          |

- **Router:** solo Pages Router (`pages/`). No hay carpeta `app/`.
- **Build:** puede fallar con "Converting circular structure to JSON" por la combinación TypeScript 4.5 + Next 13.

---

## 2. Ya hecho

- [x] Next 12 → 13 y React 17 → 19.
- [x] PayPal en `_app.tsx`: la app arranca sin `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (render condicional).
- [x] `AuthProvider` tipado con `FC<PropsWithChildren>` por compatibilidad con React 19.

---

## 3. Pendiente (checklist detallado)

### 3.1 Middleware unificado

En Next 13+ solo existe **un** middleware: un archivo `middleware.ts` (o `middleware.js`) en la **raíz del proyecto** (mismo nivel que `pages/` o `app/`). Los `_middleware.ts` dentro de carpetas ya no se usan.

**Archivos actuales a consolidar:**

| Archivo                         | Protege                         | Comportamiento actual                                                                 |
|---------------------------------|----------------------------------|---------------------------------------------------------------------------------------|
| `pages/admin/_middleware.ts`    | Rutas `/admin/*`                | Sin sesión → redirect a `/auth/login?p=<página>`. Sin rol admin/super-user/SEO → `/`. |
| `pages/checkout/_middleware.ts`  | Rutas `/checkout/*`             | Sin sesión → redirect a `/auth/login?p=<página>`.                                     |
| `pages/api/admin/_middleware.ts`| Rutas `/api/admin/*`           | Sin sesión o sin rol → 401 JSON.                                                      |
| `hooks/_middleware.ts`          | —                               | No se usa para rutas; se puede eliminar.                                              |

**Cambios obligatorios en el nuevo middleware:**

1. **Eliminar** el segundo parámetro `NextFetchEvent` (deprecado/eliminado en Next 13+).
2. **Sustituir** `req.page.name` por `request.nextUrl.pathname` (la API `page` ya no existe).
3. **Unificar lógica:** en un solo `middleware.ts` en raíz, usar `request.nextUrl.pathname` para decidir:
   - Si empieza por `/admin` (y no es `/api/admin`) → lógica de admin (sesión + roles).
   - Si empieza por `/checkout` → lógica de checkout (solo sesión).
   - Si empieza por `/api/admin` → lógica de API admin (sesión + roles, respuesta 401 JSON).

**Ejemplo de estructura del nuevo `middleware.ts` (pseudocódigo):**

```ts
// middleware.ts (en la raíz)
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rutas de API admin
  if (pathname.startsWith('/api/admin')) {
    const session = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!session) return response401();
    if (!['admin','super-user','SEO'].includes(session.user.role)) return response401();
    return NextResponse.next();
  }

  // Rutas de panel admin (páginas)
  if (pathname.startsWith('/admin')) {
    const session = await getToken({ ... });
    if (!session) return NextResponse.redirect(`/auth/login?p=${pathname}`);
    if (!validRoles.includes(session.user.role)) return NextResponse.redirect('/');
    return NextResponse.next();
  }

  // Rutas de checkout
  if (pathname.startsWith('/checkout')) {
    const session = await getToken({ ... });
    if (!session) return NextResponse.redirect(`/auth/login?p=${pathname}`);
    return NextResponse.next();
  }

  return NextResponse.next();
}
```

**Después de crear `middleware.ts`:**
- Eliminar `pages/admin/_middleware.ts`
- Eliminar `pages/checkout/_middleware.ts`
- Eliminar `pages/api/admin/_middleware.ts`
- Eliminar `hooks/_middleware.ts`

---

### 3.2 Actualizar Next.js y ESLint

1. **Next 13 → 14**
   - `yarn add next@14` (o `npm i next@14`).
   - `yarn add -D eslint-config-next@14`.
   - Revisar [upgrading guide Next 14](https://nextjs.org/docs/app/building-your-application/upgrading/version-14).
   - Probar `yarn build` y `yarn dev`.

2. **Next 14 → 15**
   - `yarn add next@15` y `yarn add -D eslint-config-next@15`.
   - Revisar [upgrading guide Next 15](https://nextjs.org/docs/app/building-your-application/upgrading/version-15).
   - Probar build y rutas protegidas (admin, checkout, API admin).

---

### 3.3 Actualizar TypeScript

- Instalar TypeScript 5.x: `yarn add -D typescript@5` (o la última 5.x).
- Opcional en `tsconfig.json` para proyectos Next modernos:
  - `"moduleResolution": "bundler"` o `"node16"`.
- Eliminar la referencia a `pages/_app.jsx` en `include` si ese archivo no existe (solo tienes `_app.tsx`).
- Tras actualizar, el error "Converting circular structure to JSON" en build suele desaparecer.

---

### 3.4 Tipos de React 19 en `_app.tsx`

Tras la migración, si siguen apareciendo errores de tipo con:
- `SessionProvider` (next-auth)
- `CssBaseline` (MUI)
- `SWRConfig` (swr)

se pueden usar casts como antes:

```ts
import type { ReactNode } from 'react';

const SessionProviderTyped = SessionProvider as React.ComponentType<{ children?: ReactNode }>;
const CssBaselineTyped = CssBaseline as React.ComponentType<{ children?: ReactNode }>;
const SWRConfigTyped = SWRConfig as React.ComponentType<{ children?: ReactNode; value?: ... }>;
```

y usar `SessionProviderTyped`, `CssBaselineTyped`, `SWRConfigTyped` en el JSX. La lógica de PayPal (render condicional si no hay client-id) se mantiene.

---

### 3.5 (Opcional) next-auth v4 → v5 (Auth.js)

- next-auth v4 funciona con Next 13/14/15 en Pages Router, pero v5 está pensado para Next 14+ y App Router.
- Si se migra a v5:
  - Nueva configuración (archivo de config, Route Handlers).
  - Uso de `auth()` en lugar de `getSession()` en algunos contextos.
  - Revisar [next-auth v5 migration](https://authjs.dev/getting-started/migrating-to-v5).
- No es obligatorio para tener Next 15 funcionando con Pages Router.

---

### 3.6 next.config.js

- Revisar la [documentación de Next 14/15](https://nextjs.org/docs/app/api-reference/next-config-js) por opciones deprecadas o renombradas.
- Con solo Pages Router y `reactStrictMode: true` no suele haber cambios críticos.
- Si más adelante se usa `next/image` con dominios externos, añadir `images.domains` (o la opción equivalente en tu versión).

---

### 3.7 Páginas con getServerSideProps / getStaticProps / getStaticPaths

Estas APIs siguen soportadas en Next 15 con **Pages Router**. No es obligatorio cambiarlas para completar la migración.

| Archivo                      | Uso                          |
|-----------------------------|------------------------------|
| `pages/auth/login.tsx`      | getServerSideProps           |
| `pages/auth/register.tsx`   | getServerSideProps           |
| `pages/orders/history.tsx`  | getServerSideProps           |
| `pages/orders/[id].tsx`     | getServerSideProps           |
| `pages/search/[query].tsx`  | getServerSideProps           |
| `pages/admin/orders/[id].tsx` | getServerSideProps         |
| `pages/admin/products/[slug].tsx` | getServerSideProps   |
| `pages/product/[slug].tsx`  | getStaticPaths + getStaticProps |

Si en el futuro se migran rutas al **App Router** (`app/`), habría que sustituir por Server Components, `fetch` en servidor y `generateStaticParams` donde corresponda.

---

## 4. Orden recomendado

1. **Middleware:** crear `middleware.ts` en raíz, probar admin/checkout/api admin, eliminar los `_middleware.ts` viejos.
2. **TypeScript:** actualizar a 5.x y ajustar `tsconfig` si hace falta; verificar que `yarn build` pase.
3. **Next 14:** actualizar `next` y `eslint-config-next`, revisar changelog, probar build y rutas.
4. **Next 15:** mismo proceso.
5. **Tipos en _app:** si aparecen errores de SessionProvider/CssBaseline/SWRConfig, reintroducir los casts.
6. **(Opcional)** next-auth v5 y/o pasos hacia App Router cuando lo decidas.

---

## 5. Verificación final

- [ ] `yarn build` termina sin errores.
- [ ] `yarn dev`: la home y listado de productos cargan.
- [ ] Sin login: al entrar en `/admin` o `/checkout` redirige a login.
- [ ] Con login admin: se accede a `/admin` y a `/api/admin/*`.
- [ ] Con login usuario normal: checkout funciona; admin da redirect a `/`.
- [ ] Variable `HOST_NAME` en `.env` para que las imágenes de productos carguen (ej. `http://localhost:3000/`).
- [ ] PayPal: con `NEXT_PUBLIC_PAYPAL_CLIENT_ID` en `.env` los botones de pago funcionan; sin ella la app sigue arrancando.

---

*Última revisión según estado del proyecto: Next 13, React 19, Pages Router, next-auth v4.*
