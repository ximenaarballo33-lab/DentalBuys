# Dental Buys

Plataforma web para depósitos dentales con:

- Dashboard financiero y operativo
- Ventas y ganancias con registro de transacciones
- Inventario de productos dentales y alimentarios
- Alertas de caducidad
- Analíticas: rotación, ticket promedio, margen, activos, tendencia, categoría
- Escaneo de código de barras por cámara
- Usuario único con acceso total
- Modo claro/oscuro

## 1) Configuración Firebase

1. Crea un proyecto en Firebase.
2. Activa `Authentication > Email/Password`.
3. Activa `Firestore Database`.
4. Copia `firebase-config.example.js` a `firebase-config.js` y pega tu configuración.

## 2) Colecciones usadas

- `products`
- `sales`
- `activities`

## 3) Ejecutar local

Puedes usar cualquier servidor estático. Ejemplo:

```bash
npx serve .
```

Luego abre la URL local que te indique la terminal.

## 4) Reglas iniciales sugeridas (Firestore)

Ajusta estas reglas según seguridad de tu operación:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 5) Deploy en Cloudflare Pages

1. Instala Wrangler:
```bash
npm i -g wrangler
```
2. Login Cloudflare:
```bash
wrangler login
```
3. Completa `wrangler.toml` con `account_id`.
4. Completa `firebase-config.js` con tus datos reales del SDK web.
5. Publica en Cloudflare Pages:
```bash
npx wrangler pages deploy . --project-name dental-buys
```

## 6) Reglas de Firestore (si usarás DB con Firebase)

```bash
npx firebase-tools deploy --only firestore
```
