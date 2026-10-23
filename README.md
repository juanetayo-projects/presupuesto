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

> **Lógica de la app: Plan vs. Real.** El **plan** (tabla `gastos`) son los compromisos que se espera pagar cada mes (cuotas, servicios, tarjetas), generados desde la plantilla. Lo **real** (tabla `movimientos`) son los gastos que se pagaron y los ingresos que se recibieron; cada uno queda en el mes de **su fecha**. Pagar un compromiso crea su movimiento (un trigger lo marca como pagado); un gasto imprevisto es un movimiento sin compromiso. Los meses futuros sólo tienen plan (estimado a pagar).

- **Movimientos**: registro en un paso de gastos pagados e ingresos recibidos, filtros por rango de fechas, categoría y persona, enlace opcional a un compromiso del plan y a una deuda, exportación a Excel.
- **Plan**: compromisos del mes (antes "Gastos"): lista por categoría o calendario, cuotas, pagar con un toque.
- **Clonar plan**: copia el plan de un mes a otro. Cada compromiso es **crédito** (cuota de una deuda: arrastra lo que quedó sin pagar en el mes origen), **fijo** (mismo valor) o **variable** (cambia); se elige qué tipos clonar y se ve la vista previa con el saldo de cada deuda antes de crear nada.

- **Inicio**: KPIs (ingresos recibidos, gastado, plan del mes, por pagar del plan, balance, deuda al cierre del mes), comparativo con el mes anterior, plan vs. real por categoría, alertas de pago, donut por categoría y barras por concepto (en % del total de gastos), tendencia de 6 meses, regla 50/30/20, metas y ejecución por categoría.
- **Gastos**: lista agrupada por categoría o **calendario de pagos**; filtros por categoría, medio de pago y estado; pago con un toque (valor, fecha, quién pagó, abono a capital); gastos divididos en **N cuotas**; exportación a Excel.
- **Histórico**: tabla mes a mes por categoría (expandible a conceptos) con lo realmente pagado, ingreso y disponible; gráfico de evolución por categoría; exportación a Excel. Los meses futuros se muestran como **valores estimados a pagar**.
- **Cierre de mes**: un mes cerrado queda congelado en la base (trigger `validar_mes_abierto`) y sus cifras no cambian al trabajar en otros meses. La deuda del Inicio se calcula al cierre del mes elegido.
- **Motion**: números que cuentan, barras que cargan, gauge con aguja, pestañas con píldora deslizante y líneas que se dibujan (modelo: "12 Motion Graphics with Opus 5.5"); respeta "reducir movimiento".
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

**Logos:** cada ítem u obligación puede tener el sitio web de la marca (`davivienda.com`); la app muestra su favicon oficial mediante el servicio de favicons de Google. Si no hay logo, se dibuja un icono isométrico con el color de la categoría.

> Los datos y las cifras de la familia **no** están en este repositorio: viven sólo en Supabase. La carpeta `privado/` está ignorada por git.
