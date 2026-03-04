# Backend – Next-Teslo

Documentación de alto nivel del backend del proyecto (API routes, capa de
datos y servicios externos), siguiendo el formato code-explainer.

---

### Qué hace este backend

- **API REST** bajo Next.js (Pages Router) en `pages/api/`: productos,
  órdenes, usuarios, búsqueda, auth y panel admin.
- **Autenticación**: NextAuth con Credentials (email/password) y GitHub
  OAuth; sesión JWT (30 días, actualización diaria).
- **Tienda**: listado de productos (por género), producto por slug,
  búsqueda por texto (MongoDB `$text`), creación de órdenes con
  validación de totales y pagos con PayPal.
- **Admin**: CRUD productos, subida de imágenes (Cloudinary), listado de
  órdenes y usuarios, dashboard con métricas, cambio de roles.
- **Datos**: MongoDB (Mongoose). Capa `database/` con `db`, `dbProducts`,
  `dbOrders`, `dbUsers` que encapsulan conexión y consultas.
- **Cliente HTTP**: `api/tesloApi.ts` es un axios con `baseURL: '/api'`
  para llamar a las rutas desde el front.

---

### Cómo funciona (flujo)

- **Entrada:** peticiones HTTP a `/api/*` (Next.js API Routes).
- **Procesamiento:**
  - Handler por método (GET/POST/PUT) → `db.connect()` → uso de modelos
    (Product, Order, User) o helpers de `database/` → `db.disconnect()` →
    respuesta JSON.
  - Auth: NextAuth usa `dbUsers.checkUserEmailPassword` (Credentials) o
    `dbUsers.oAUthToDbUser` (OAuth); callbacks JWT/session inyectan
    `token.user` / `session.user`.
  - Órdenes: POST en `/api/orders` crea orden (validación de precios y
    sesión); POST en `/api/orders/pay` valida pago en PayPal y marca
    orden como pagada.
- **Salida:** JSON (listas, entidad, `{ message }`).
- **Efectos secundarios:** escritura en MongoDB, subida/borrado en
  Cloudinary (admin productos), llamadas a PayPal OAuth y Orders API.

---

### Dependencias y contratos

- **Framework:** Next.js (Pages API Routes), NextAuth.
- **Base de datos:** MongoDB vía Mongoose; `MONGO_URL` obligatorio.
- **Modelos:** `User`, `Product`, `Order` en `models/`; índices en
  Product (`title`, `tags`) para búsqueda por texto.
- **APIs externas:**
  - PayPal: `PAYPAL_OAUTH_URL`, `PAYPAL_ORDERS_URL`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`.
  - Cloudinary: `CLOUDINARY_URL` (admin upload y borrado de imágenes).
  - GitHub OAuth (opcional): `GITHUB_ID`, `GITHUB_SECRET`.
- **Utilidades:** `database/` (db, dbProducts, dbOrders, dbUsers),
  `utils/jwt`, `utils/validations`, `bcryptjs` para contraseñas.
- **Constantes:** `SHOP_CONSTANTS.validGenders` (men, women, kid, unisex);
  `NEXT_PUBLIC_TAX_RATE`, `HOST_NAME` para URLs de imágenes.

---

### Supuestos

- MongoDB accesible y con índices de texto en Product para búsqueda.
- En producción no se llama `db.disconnect()` en desarrollo (solo en
  producción) para reutilizar conexiones entre requests.
- Rutas admin protegidas por middleware/rol en front; algunas APIs
  admin no validan sesión/rol en el handler (riesgo si se llama directo).
- PayPal: el front envía `transactionId` y `orderId`; el backend confía
  en que el usuario pagó si el estado en PayPal es COMPLETED y el monto
  coincide.
- Imágenes: se normalizan URLs con `HOST_NAME` cuando no son `http(s)`.

---

### Riesgos y detalles importantes

- **Concurrencia:** conexión MongoDB compartida (`mongoConnection.isConnected`);
  en dev no se desconecta, correcto para serverless/reuso. Posible
  condición si muchos connect/disconnect simultáneos en edge cases.
- **Manejo de errores:** varios handlers hacen `db.disconnect()` en
  catch/early return; si falta un path puede quedar conexión abierta.
  Algunos errores solo `console.log` y respuesta genérica.
- **Rendimiento:** `db.connect()`/`disconnect()` en cada request;
  aceptable con pool de Mongoose; búsqueda por `$text` requiere índice.
- **Seguridad:** `/api/orders/pay` tiene TODOs de validar sesión y
  MongoID. Register devuelve JWT pero el login principal es NextAuth;
  doble flujo (register vs login con credentials). Roles en User
  (admin, client, super-user, SEO); validación de rol en backend
  no uniforme en todas las rutas admin.
- **Observabilidad:** pocos logs; sin IDs de request ni métricas;
  errores de PayPal/Cloudinary solo en consola.

---

### TODOs / mejoras

- **Rápidos:** validar sesión y MongoID en `/api/orders/pay`; asegurar
  que todas las rutas admin comprueben sesión y rol; normalizar
  mensajes de error y códigos HTTP.
- **Seguimiento:** middleware o wrapper que centralice `db.connect`/
  `disconnect` y manejo de errores; eliminar fotos en Cloudinary de
  forma consistente en update product; revisar que no queden
  `db.disconnect()` faltantes en todos los branches; añadir tests
  de integración para órdenes y pagos.

---

### Ejemplo de flujo (pseudo)

```
Cliente → POST /api/orders { orderItems, total }
  → getSession(req) → 401 si no hay sesión
  → db.connect()
  → Product.find({ _id: { $in: ids } })
  → recalcular subTotal (precios desde DB), total con TAX_RATE
  → si total !== backendTotal → 400
  → new Order({ ...body, user: session.user._id }).save()
  → db.disconnect() → 201 newOrder

Cliente → POST /api/orders/pay { orderId, transactionId }
  → getPaypalBearerToken() (Basic auth a PAYPAL_OAUTH_URL)
  → GET PayPal Orders API con transactionId
  → si status !== 'COMPLETED' → 401
  → db.connect() → Order.findById(orderId)
  → comprobar monto con data.purchase_units[0].amount.value
  → order.transactionId = ...; order.isPaid = true; save()
  → db.disconnect() → 200
```

---

### Mapa rápido de rutas API

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/auth/[...nextauth]` | * | NextAuth (login, OAuth, session) |
| `/api/products` | GET | Lista productos (query: gender) |
| `/api/products/[slug]` | GET | Producto por slug |
| `/api/search/[q]` | GET | Búsqueda por texto (q) |
| `/api/orders` | POST | Crear orden (session) |
| `/api/orders/pay` | POST | Confirmar pago PayPal |
| `/api/user/register` | POST | Registro + JWT |
| `/api/user/login` | * | (probable redirección a NextAuth) |
| `/api/user/validate-token` | GET | Validar JWT |
| `/api/admin/products` | GET/POST/PUT | CRUD productos |
| `/api/admin/upload` | POST | Subir imagen → Cloudinary |
| `/api/admin/orders` | GET | Listar órdenes |
| `/api/admin/users` | GET/PUT | Listar usuarios / actualizar rol |
| `/api/admin/dashboard` | GET | Métricas (órdenes, clientes, stock) |
| `/api/seed` | GET/POST | Seed DB (solo no producción) |
