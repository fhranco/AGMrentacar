---
name: Modern Retail Mobility
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#404a35'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#707b63'
  outline-variant: '#c0caaf'
  surface-tint: '#3d6a00'
  primary: '#3d6a00'
  on-primary: '#ffffff'
  primary-container: '#8ae600'
  on-primary-container: '#386200'
  inverse-primary: '#84dd00'
  secondary: '#575e70'
  on-secondary: '#ffffff'
  secondary-container: '#d9dff5'
  on-secondary-container: '#5c6274'
  tertiary: '#006a63'
  on-tertiary: '#ffffff'
  tertiary-container: '#88ded4'
  on-tertiary-container: '#00635c'
  error: '#DC2626'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9dfb29'
  primary-fixed-dim: '#84dd00'
  on-primary-fixed: '#0f2000'
  on-primary-fixed-variant: '#2d5000'
  secondary-fixed: '#dce2f7'
  secondary-fixed-dim: '#c0c6db'
  on-secondary-fixed: '#141b2b'
  on-secondary-fixed-variant: '#404758'
  tertiary-fixed: '#9cf2e8'
  tertiary-fixed-dim: '#80d5cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#00504a'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  brand-lime: '#8AE600'
  brand-lime-hover: '#76CC00'
  brand-lime-subtle: '#F2FDE6'
  slate-950: '#0A0F1D'
  slate-900: '#111827'
  slate-800: '#1E293B'
  slate-700: '#334155'
  slate-500: '#64748B'
  slate-300: '#CBD5E1'
  slate-200: '#E2E8F0'
  slate-100: '#F1F5F9'
  surface-bg: '#F8FAFC'
  surface-white: '#FFFFFF'
  success: '#16A34A'
  warning: '#F59E0B'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 34px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  currency-display:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 32px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  gutter-lg: 2rem
  margin: 1.5rem
  margin-sm: 1rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system elevates a legacy retail mobility provider into a crisp, dependable, and high-velocity digital booking experience. Designed for both domestic retail travelers across Chile and corporate fleet procurement managers, the identity communicates absolute operational dependability, transparent pricing, and effortless velocity.

The aesthetic blends **Corporate Modernism** with clean **Minimalist** clarity:
- **High functional clarity**: The unmistakable fluorescent lime brand energy is disciplined into targeted focal points—critical interactive conversions, active state indicators, and key navigational milestones—avoiding sensory fatigue.
- **Deep Slate Trust**: Paired with deep charcoal and slate surfaces, the fluorescent green shifts from novelty to professional high-contrast performance.
- **Clean Tactical Precision**: Elevated surfaces on soft off-white canvas create a structured, reassuring atmosphere that turns complex vehicle booking, coverage upgrades, and multi-branch returns into a friction-free workflow.

## Colors

The color palette establishes high visual contrast and structural hierarchy:

- **Primary (`#8AE600`)**: The signature vibrant lime green. Reserved strictly for primary call-to-action triggers (such as "Buscar", "Reservar ahora", "Continuar"), selected states, and pivotal trust markers. When paired with `#8AE600`, text labels inside buttons MUST use dark slate (`#111827`) to guarantee WCAG AAA legibility. Never render white text on primary lime.
- **Secondary (`#111827`)**: Deep rich slate. Used for primary headlines, dark navigational top bars, search bar headers, vehicle title typography, and high-impact structural panels.
- **Tertiary (`#0F766E`)**: Deep petrol teal, used sparingly for corporate leasing badges, verified insurance indicators, and technical guarantee tags to provide depth alongside the lime.
- **Neutrals (`#F8FAFC` to `#334155`)**: The background canvas utilizes crisp cool white `#F8FAFC`, allowing pure `#FFFFFF` cards to project soft, natural layers. Borders stay muted with `#E2E8F0` and `#CBD5E1` to keep booking grids distraction-free.

## Typography

The typographic hierarchy couples **Plus Jakarta Sans** for structural headers, card titles, badges, and monetary figures with **Inter** for dense transactional copy, terms, vehicle specifications, and operational instructions.

- **Headlines & Display**: Plus Jakarta Sans provides geometric modernity and crisp terminal endings, lending warmth and technical authority to fleet categories and promotional messaging. Bold weights (-0.02em tracking) balance the vivid lime accent.
- **Body Text**: Inter provides neutral legibility across tabular vehicle data, date pickers, branch address listings, and rental requirements.
- **Numbers & Currencies**: All pricing models (e.g., "$32.990 / día") leverage Plus Jakarta Sans Bold with proportional figures for immediate clarity during vehicle comparison.

## Layout & Spacing

The layout is built on an **8-point spatial grid** running inside a **12-column responsive fluid grid** with a maximum content container width of `1280px`.

### Responsive Breakpoints & Margins
- **Desktop (1024px+)**: 12 columns, `gutter-lg: 2rem (32px)`, outer canvas `margin-lg: 3rem (48px)`. The booking engine spans full width or docks persistently at the top.
- **Tablet (768px – 1023px)**: 8 columns, `gutter: 1.5rem (24px)`, canvas `margin: 1.5rem (24px)`. Booking fields split into 2x2 grid patterns.
- **Mobile (< 768px)**: 4 columns, `gutter-sm: 1rem (16px)`, canvas `margin-sm: 1rem (16px)`. The booking bar transforms into a stacked vertical sheet or accessible bottom drawer.

Component interiors maintain compact densities: form fields use `space-md (16px)` vertical padding, chip containers use `space-sm (8px)` gap spacing, and vehicle specification cards maintain an interior gutter of `space-lg (24px)`.

## Elevation & Depth

Visual depth is achieved through **ambient slate-tinted diffusion** combined with **subtle low-contrast borders**, ensuring that high-contrast cards remain clean without heavy or dated shadows.

- **Level 0 (Flat Canvas)**: `#F8FAFC` base surface with no shadow.
- **Level 1 (Resting Cards, Vehicle Grid Items)**: `#FFFFFF` fill with border `1px solid #E2E8F0` and subtle shadow: `0 1px 3px rgba(17, 24, 39, 0.04), 0 1px 2px rgba(17, 24, 39, 0.02)`.
- **Level 2 (Hover State, Interactive Modules)**: `#FFFFFF` fill, border `1px solid #CBD5E1`, shadow: `0 8px 20px -4px rgba(17, 24, 39, 0.08), 0 4px 8px -2px rgba(17, 24, 39, 0.04)`.
- **Level 3 (Search Console, Floating Booking Bar, Overlays)**: `#FFFFFF` with border `1px solid rgba(226, 232, 240, 0.8)`, shadow: `0 20px 30px -10px rgba(17, 24, 39, 0.12), 0 8px 10px -4px rgba(17, 24, 39, 0.04)`.
- **Level 4 (Modals, Branch Select Flyouts)**: `#FFFFFF`, shadow: `0 25px 50px -12px rgba(15, 23, 42, 0.25)`.
- **Focus Ring / Glow**: Interactive primary elements use a sharp dual-ring focus state: `0 0 0 2px #FFFFFF, 0 0 0 4px #8AE600`.

## Shapes

The design uses **Level 2 Roundedness** (0.5rem base radius) to establish a friendly, contemporary, and reliable aesthetic:

- **Base Inputs, Dropdowns & Standard Buttons**: `rounded-md` (`0.5rem` / `8px`).
- **Vehicle Cards & Search Engine Bar**: `rounded-lg` (`1rem` / `16px`).
- **Feature Banners & Promotional Modals**: `rounded-xl` (`1.5rem` / `24px`).
- **Filter Chips & Status Pills**: `rounded-full` (`9999px`) for quick tactile scanning across categories (e.g., "SUV", "Económico", "Camionetas").

## Components

### 1. Booking Search Bar (Engine Core)
- **Container**: White elevated panel (`rounded-lg`, Level 3 elevation, `1px solid #E2E8F0`).
- **Fields (Sucursal de retiro, Fecha y Hora de retiro, Fecha y Hora de devolución)**: Segmented tiles with a soft neutral background (`#F8FAFC`) on resting state and `#FFFFFF` on active focus. Includes distinct mini-labels (`label-sm`, slate-500 uppercase) positioned directly above primary selection text.
- **Different Drop-off Toggle**: A clean switch or checkbox reading *"Devolver en otra sucursal"*, dynamically expanding an additional branch input with smooth height animation.
- **Search Trigger ("Buscar")**: Bold primary lime button (`#8AE600`), slate-900 bold text, full-height alignment with input segments.

### 2. Buttons
- **Primary**: Background `#8AE600`, text `#111827` (`label-lg`), no border, `rounded-md`. Hover: `#76CC00`. Active: transform scale(0.98).
- **Secondary / Dark**: Background `#111827`, text `#FFFFFF`, hover: `#1E293B`.
- **Ghost / Outlined**: Background transparent, border `1.5px solid #E2E8F0`, text `#1E293B`. Hover: `#F1F5F9` background with `#0F172A` text.

### 3. Vehicle Category Chips & Filters
- **Resting**: Background `#FFFFFF`, border `1px solid #CBD5E1`, text `#334155`, `rounded-full`, padding `8px 16px`.
- **Active / Selected**: Background `#111827`, border `1px solid #111827`, text `#8AE600` (high contrast, premium neon accentuation).

### 4. Vehicle Inventory Cards
- **Structure**: Vertical card layout on mobile, horizontal split layout on desktop comparison views.
- **Header**: Category tag (e.g., "Categoría B • Hatchback") in `label-sm`, slate-500, beside dynamic availability pills.
- **Media**: High-res vehicle render centered over a faint radial gradient (`#F8FAFC` to `#FFFFFF`).
- **Specifications Row**: Inline icons (transmission, passenger count, luggage capacity, A/C) separated by subtle slate dividers.
- **Pricing & CTA Footnote**: Right-aligned price hierarchy showing daily rate in `currency-display` (`#111827`) and total booking estimate in `body-sm` (`#64748B`), anchored by a primary CTA.

### 5. Input Fields & Selects
- **Height**: 48px standard.
- **Borders**: 1px solid `#CBD5E1` on resting, smoothly transitioning to 2px solid `#8AE600` on focus with no red or blue browser defaults.
- **Icons**: Left-aligned branch or calendar icon in `#64748B`.

### 6. Corporate Perks & Trust Badges
- **Corporate Badge ("Convenio Empresas")**: Rich dark slate capsule (`#111827`) with vibrant lime highlight ring and crisp white copy.
- **Trust Seals ("e-check", "Sin Filas", "Cobertura Nacional")**: Dual-toned circular icons utilizing `#F2FDE6` background fill with `#8AE600` vector strokes, accompanied by tight `title-md` and `body-sm` typography.