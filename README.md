# Presupuesto familia Etayo-Murillo

App web mobile-first (instalable como PWA) para llevar el presupuesto mensual del hogar: gastos recurrentes y eventuales, cuotas, imprevistos, préstamos y tarjetas con saldo, metas de ahorro y alertas de pago.

**Producción:** https://juanetayo-projects.github.io/presupuesto/

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 19 + Vite 6 + TypeScript, **shadcn/ui** (Radix, Tailwind CSS 4), lucide-react, sonner |
| Gráficas | Recharts (vía `ChartContainer` de shadcn) |
| Datos | Supabase (PostgreSQL + Auth + RLS) |
| Rutas | `HashRouter` (GitHub Pages) |
| Export | xlsx (carga diferida) |
| Deploy | GitHub Actions → GitHub Pages |

## Funcionalidades

- **Inicio**: KPIs (ingreso, total de gastos, pagado, por pagar, disponible, deuda), alertas de pago, donut por categoría y barras por concepto (en % del total de gastos), tendencia de 6 meses, regla 50/30/20, metas y ejecución por categoría.
- **Gastos**: lista agrupada por categoría o **calendario de pagos**; filtros por categoría, medio de pago y estado; pago con un toque (valor, fecha, quién pagó, abono a capital); gastos divididos en **N cuotas**; exportación a Excel.
- **Deudas**: préstamos, tarjetas, compras a cuotas (ADDI) y cadenas de ahorro, con saldo automático, historial, plan **bola de nieve / avalancha** y **metas de ahorro**.
- **Ajustes**: ingresos del mes, plantilla de **categorías e ítems**, clase 50/30/20 y colores, días de alerta y notificaciones, miembros de la familia.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

El esquema de la base está en [`supabase/schema.sql`](supabase/schema.sql). El acceso está restringido por RLS a los correos de la tabla `miembros`.

### Deploy

`git push origin main` dispara `.github/workflows/deploy.yml`. Requiere los secretos del repositorio `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` y, en Settings → Pages, la fuente "GitHub Actions".

> Los datos y las cifras de la familia **no** están en este repositorio: viven sólo en Supabase. La carpeta `privado/` está ignorada por git.
