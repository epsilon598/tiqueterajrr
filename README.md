📘 README — Tiquetera 🎟️
🧾 Descripción general

Tiquetera es una aplicación web de venta y gestión de boletos desarrollada con Next.js 15, Prisma, PostgreSQL, Next-Auth, Wompi (sandbox) y Nodemailer.
Permite:

Mostrar eventos disponibles y sus asientos.

Realizar compras con pago en línea.

Enviar boletos con QRs únicos por correo electrónico.

Validar los boletos mediante una cámara o “cámara virtual” desde la vista de administrador.

⚙️ Tecnologías principales
Tecnología	Uso
Next.js 15	Frontend y API Routes.
Prisma ORM	Conexión y modelo de datos con PostgreSQL.
PostgreSQL	Base de datos relacional.
Next-Auth	Autenticación por credenciales o Google OAuth.
Nodemailer	Envío de correos con los boletos (QRs adjuntos).
Wompi (sandbox)	Procesamiento de pagos en entorno de prueba.
Ngrok	Túnel HTTPS para pruebas locales con webhooks.
@zxing/browser	Lector de QR en navegador para escaneo de boletos.
TailwindCSS 4	Estilos rápidos y responsivos.
🧩 Estructura del proyecto
src/
 ├─ app/
 │   ├─ api/                → Endpoints del backend
 │   │   ├─ events/[…]/     → Eventos y asientos
 │   │   ├─ orders/[…]/     → Pedidos
 │   │   ├─ webhooks/wompi/ → Webhook de confirmación de pagos
 │   │   ├─ wompi/confirm/  → Confirmación manual
 │   │   └─ tickets/validate→ Validación QR (admin)
 │   ├─ checkout/confirm/   → Página de confirmación de pago
 │   ├─ events/[…]/         → Detalle de evento con grilla de asientos
 │   ├─ scan/               → Cámara del admin (lector QR)
 │   └─ page.tsx            → Página principal (lista de eventos)
 │
 ├─ lib/
 │   ├─ prisma.ts           → Cliente Prisma
 │   ├─ baseUrl.ts          → Manejo de URL base
 │   ├─ mail.ts             → Configuración SMTP
 │   └─ tickets.ts          → Generación de QR y lógica de precios
 │
 ├─ prisma/
 │   ├─ schema.prisma       → Modelo de base de datos
 │   └─ seed.ts             → Script de inicialización con datos base
 │
 └─ .env.example            → Variables de entorno

🚀 Instalación y configuración
1️⃣ Clonar el repositorio
git clone https://github.com/<tu-usuario>/tiquetera.git
cd tiquetera

2️⃣ Instalar dependencias
npm install

3️⃣ Configurar base de datos PostgreSQL

Asegúrate de tener PostgreSQL corriendo localmente (o en Docker).
Crea una base llamada tiquetera y copia tu conexión en .env.

DATABASE_URL="postgresql://postgres:password@localhost:5432/tiquetera?schema=public"

4️⃣ Variables de entorno

Copia el archivo de ejemplo:

cp .env.example .env


Y completa los valores según tus credenciales de Gmail y Wompi:

NEXTAUTH_SECRET="clave_secreta_segura"
NEXTAUTH_URL="http://localhost:3000"

# SMTP (correo)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="tu_correo@gmail.com"
SMTP_PASS="clave_app_de_gmail"
MAIL_FROM="Tiquetera <tu_correo@gmail.com>"

# Wompi sandbox
WOMPI_PUBLIC_KEY="pub_test_..."
WOMPI_PRIVATE_KEY="prv_test_..."
WOMPI_INTEGRITY_KEY="test_integrity_..."
WOMPI_API_URL="https://sandbox.wompi.co/v1"
WOMPI_WEBHOOK_SECRET="my_wompi_sandbox_secret"


💡 En Gmail debes crear una “contraseña de aplicación” desde tu cuenta (no la contraseña normal).

🧰 Prisma y datos iniciales
Crear estructura
npx prisma migrate dev --name init

Insertar datos de prueba
npm run seed


Esto creará:

Un usuario admin (admin@tiquetera.com / Admin1234).

Un venue (Teatro Central con asientos).

Un evento de prueba (Concierto de Lanzamiento).

🌐 Ngrok (webhook local)

Para que Wompi envíe notificaciones a tu entorno local:

ngrok config add-authtoken TU_TOKEN
npx ngrok http 3000


Copia la URL HTTPS que aparece (https://xxxxx.ngrok-free.app)
y configúrala en tu dashboard de Wompi → Webhooks.

▶️ Ejecución del proyecto
npm run dev


Abre:
👉 http://localhost:3000

🔒 Autenticación

Inicio de sesión con Google OAuth o con usuario/contraseña.

Los administradores pueden acceder a /scan para validar tickets.

📦 Envío de boletos (correo)

Cuando Wompi aprueba un pago:

Se generan QRs únicos con generateQRDataURL().

Se envía un correo con los boletos adjuntos (sendTicketsEmail()).

Los boletos quedan registrados en la tabla Ticket.

🧾 Validación QR (vista del admin)

En /scan puedes:

Usar la cámara del navegador (BrowserQRCodeReader).

Usar la “cámara virtual”: subir una imagen o pegar texto del QR.

Validar el ticket contra la base de datos.

Marcarlo como usado en caso de validación exitosa.

🧠 Notas de desarrollo

Si tu red tiene problemas con IPv6, en lib/mail.ts y api/wompi/confirm/route.ts ya se fuerza IPv4 con:

import { setDefaultResultOrder } from "node:dns";
setDefaultResultOrder?.("ipv4first");


El proyecto usa dynamic = "force-dynamic" en endpoints críticos para evitar cache en SSR.

Puedes adaptar las URLs para despliegue en Vercel, Render o Railway sin modificar rutas internas.

🧪 Tests locales rápidos

Ejecuta el proyecto.

Compra boletos con la opción Wompi sandbox → Banco que aprueba / declina.

Verifica que:

Si el banco aprueba, llega el correo con QR.

Si el banco declina, la orden queda en PENDING o DECLINED.

Valida el ticket escaneando desde /scan.