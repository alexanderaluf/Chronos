# Chronos architecture

Chronos is an offline-first Expo app for shift workers: track shifts, see what each shift paid, and estimate the month's salary after tax. All data lives in SQLite on the phone. There is no backend.

## Folder map

```
src/
├── app/                 Routes only (Expo Router). Each file reads URL params and renders one screen.
│   ├── _layout.tsx      Root providers + Stack + overlay portal + Android alert host
│   ├── (tabs)/          Home · Calendar · Stats · Settings (renders features/navigation/main-tabs)
│   ├── shifts/, paid-days/, adjustments/    Add / edit screens
│   ├── settings/        Personal info, salary, rates, additions, deductions, taxes, fixed shifts…
│   ├── profile/         Profile hub, manage jobs, new job, edit job
│   ├── tools/           Quick calculator, weekly schedule
│   └── about.tsx
│
├── domain/              Pure TypeScript business rules. No React, no Expo, no SQLite.
│   ├── entities.ts      The records the app works with (Job, Shift, PaidDay, TaxProfile…)
│   ├── money/           Integer money math (agorot, basis points, rounding)
│   ├── time/            Durations, night windows, rest days, pay periods (DST-safe)
│   ├── pay/             Shift pay, pay components, payslip, period summary, quick and global salary calculators
│   ├── tax/             Tax-system rules, personal status, credit points, mandatory deductions
│   └── domain.test.ts   Unit tests, including a real 2026 payslip reproduced to the agora
│
├── data/                Everything about storage.
│   ├── database/        Opening, migrating and writing to SQLite
│   ├── repositories/    One file per table: the only place SQL is written
│   ├── reports/         Load data + run domain calculations (month and year reports)
│   ├── hooks/           Live React hooks that re-render when tables change
│   ├── testing/         Test-only adapter: the expo-sqlite API on Node's built-in SQLite
│   └── data.test.ts     Integration tests: migrations, repositories, reports
│
├── features/            One folder per product area. Screens and their private parts.
│   ├── home/            Shifts-only ledger, grouped by day, with pay-period browsing
│   ├── create-menu/     The "+" menu (new shift, fixed shift, paid day, monthly additions)
│   ├── shifts/          Shift editor + shift hooks/components used by several features
│   ├── paid-days/       Vacation / sick / holiday editor
│   ├── adjustments/     One-off monthly bonuses and deductions
│   ├── calendar/        Month grid and the selected day
│   ├── stats/           "My salary" payslip, hours, yearly chart, report sharing
│   ├── settings/        Settings menu and every setup screen
│   ├── tools/           Quick salary calculator, weekly schedule
│   ├── about/           About & privacy
│   ├── onboarding/      First-run setup over the app: language, first job and pay, tax basics, work city, animated how-to
│   ├── profiles/        Job profiles (Plutus profiles): hub, switcher, manage, new / edit job
│   └── navigation/      The tabs, their action buttons, and the "+" menu sheet
│
├── localization/        i18next setup (en / he / ru), LocalizationProvider (language + RTL),
│                        typed locale files, label + error translation helpers
│
└── shared/              Reusable building blocks.
    ├── navigation/      Floating bottom navigation + tab shell (from Plutus)
    ├── theme/           Accent colors, theme controller, color helpers (from Plutus)
    ├── ui/              Text, icons, page layout, panels, payslip view, sliding indicator…
    │   ├── controls/    Platform-split controls: switch, segmented control, date/time input, screen header, spinner
    │   ├── overlay/     Platform-split overlays: bottom sheet, alerts; the Android portal layer
    │   └── form/        Form kit: FormScreen, fields, date/time fields, color picker, input parsing
    └── lib/             Formatting (money, hours, dates) and device locale / time zone
```

## Dependency rules

Imports only point **down** this list. Anything else is a bug.

```
app  →  features  →  data  →  domain
            ↘                    ↑
              shared  ───────────┘   (domain types and helpers; data hooks only for theme settings)
```

- `domain/` imports nothing from the app. That is what makes it testable with plain Node.
- `data/` may import `domain/`. Screens never write SQL; they call repository functions.
- `features/` may import `data/`, `domain/` and `shared/`. A feature does not import another feature. The exceptions are the cross-feature `features/shifts`, and `features/navigation`, which wires tab actions to features.
- `shared/` does not import `features/`. When shared code needs app-specific behavior, it takes it as a prop (see `TabShell`'s `actions`).
- `app/` route files only render a screen from `features/`.

## Where does new code go?

| You are adding…                          | Put it in                                                             |
| ---------------------------------------- | --------------------------------------------------------------------- |
| A new screen                             | `features/<area>/<name>-screen.tsx` + a route in `app/`               |
| An editing screen                        | Build it from `shared/ui/form` (`FormScreen` + fields)                |
| A component used by one screen           | `features/<area>/components/`                                         |
| A component used by many features        | `shared/ui/`                                                          |
| A calculation (pay, tax, time)           | `domain/` + a test in `domain/domain.test.ts`                         |
| A new table or column                    | A new migration in `data/database/migrations.ts` (see [database.md](database.md)) |
| A read/write for a table                 | `data/repositories/<table>-repository.ts` + a test in `data/data.test.ts` |
| Data a screen should show live           | A hook in `data/hooks/queries.ts`                                     |

## Correctness rules

These rules keep salary numbers trustworthy. Code review should check them.

1. **Money is integer minor units** (agorot/cents). Percentages are integer **basis points** (10000 = 100%). Rounding happens once, in `domain/money` (`divideRounded`, half away from zero).
2. **Time is stored as ISO-8601 UTC** strings and handled as `Date`. Durations come from real instants, so shifts that cross midnight or a daylight-saving change are exact. Calendar questions (which day, night hours, rest day) use the device's local time.
3. **History never changes by accident.** Shifts and paid days keep a snapshot of their hourly rate, so changing your rate only affects new records. Deletes are soft (`deleted_at`), and jobs are archived, never deleted.
4. **The UI does not calculate pay.** Screens read results from `domain/` via `data/reports`. The monthly report and both calculators (hourly and global salary) share `computePayslip`, so they always agree.
5. **Every rule value is editable.** Israeli defaults (overtime 125%/150%, rest day 150%, tax brackets, credit points, insurance) are only starting values, stored per job and per tax profile.

## Job profiles

Each job the user works at is one **profile** (the Plutus profile model, with a job in place of a person). `settings.defaultJobId` is the active profile, and everything the app shows follows it:

- **Per profile:** the job (name, color, pay, pay rules), its shifts, paid days, fixed shifts, one-off monthly items, recurring additions and deductions (`pay_components.job_id`), and four settings stored on the job row (`jobs.profile_settings_json`): `employer`, `payPeriodStartDay`, `holidayPay` and `taxStatus`. `getSettings` puts the active profile's values into `AppSettings` and `writeSettings` saves them back to the job, so screens use one settings object and never need to know which values are per profile.
- **Shared:** language, theme and other app preferences, personal info (birth date, gender, children), the tax system (`tax_profiles`) and the weekly schedule.
- **Reports:** `loadPeriodReport` prices only the active profile's records, so each job has its own payslip. Shifts may still not overlap across jobs.
- **Tax credit points** are claimed at one employer. A new job that is not the main job gets manual credit points of 0; the user can change this in Taxes.
- **UI:** `TabHeader` (`shared/ui/tab-header.tsx`) shows the active job's name and its round avatar (`ProfileAvatar`, HeroUI Avatar) above the tabs. `MainTabs` passes it to `TabShell`, which renders it once outside the tab `Slot`, floating on the shared top fade (`TopSafeAreaGradient`) like every other header, so it does not reload on a tab change. It sets the reading direction itself, and the tabs see a top safe-area inset that includes the header, so their content starts below it and scrolls under the fade. The tabs have no page title (the bottom navigation names them). Tapping it opens `/profile`: the hub with the job switcher, *Add a job* and *Manage jobs*. Onboarding creates the first profile; deleting a profile archives its job (records stay on the device, hidden), and the last profile cannot be deleted.

## First-run onboarding

`features/onboarding/onboarding-gate.tsx` wraps the Stack in the root layout and draws the setup over the app while `settings.onboardingCompletedAt` is null. It asks only what correct pay needs from the first shift: language (applied immediately, including RTL), the first job's name (the first profile), hourly or monthly pay (+ optional travel per work day), gender (credit points), employment type (insurance) and work city (holiday hours). It ends with an animated "log a shift" walkthrough. `completeOnboarding` (`data/repositories/onboarding-repository.ts`) saves everything in one transaction; everything else keeps its default and stays editable in Settings. Migration 7 marks installs that were already in use as onboarded.

## Languages and RTL

Chronos is fully translated to English, Hebrew and Russian (Plutus setup: i18next + react-i18next). Hebrew switches the whole app to right-to-left immediately; English and Russian are left-to-right. The language is `settings.appLanguage` (`null` = device language) and is chosen in General settings. Rules for adding text and RTL-safe layout are in [AGENTS.md → Localization](../AGENTS.md).

## Design and platform UI

Chronos uses the **Plutus design system**. The full rules are in [AGENTS.md → Platform UI policy](../AGENTS.md). In short:

- **Plutus design elements are custom on both platforms:**
  - every pushed page is a `FormScreen`: floating back + title header, edge-to-edge content with fades, floating Save dock with an optional secondary button such as delete,
  - `GlassSegmentedControl`,
  - large cards (`InputCard`, `PickerCard`, `ToggleCard`),
  - `SelectionSection` chips,
  - grouped `rounded-[28px]` sections with pastel icon-tile rows.
- **Date and time pickers are native on both:** a SwiftUI popover on iOS, the Material dialog on Android (`shared/ui/controls/date-time-picker-overlay`).
- **Other system components are native on iOS and from-scratch on Android:**
  - bottom sheet (`AppBottomSheet`; SwiftUI with Liquid Glass on iOS 26),
  - alerts (`AppAlert`),
  - switch (`AppSwitch`),
  - spinner (`AppSpinner`).

  Each is a pair of files with one props type: `name.ios.tsx`, `name.tsx`, `name.types.ts`. Android overlays render through `shared/ui/overlay/portal.tsx` and close with the back button.
- **When something new is needed:** use a native component on iOS with an Android twin built from scratch. If there is no native component, use HeroUI Native on both platforms. If HeroUI has nothing either, build one custom component for both.
- **Sharing** uses the system share sheet (email, WhatsApp, files). Chronos never uploads anything.

## Salary calculation, end to end

```
shifts, paid days ─┐
jobs + pay rules   ├─► data/reports/period-report.ts
pay components     │        │
adjustments        │        ▼
settings, tax      ┘   domain/pay/period-summary.ts
                         ├─ per shift: domain/pay/shift-pay.ts
                         │    worked = elapsed − break (unless breaks are paid)
                         │    night shift? → 7 h threshold instead of 8.6 h (+ optional night premium)
                         │    rest day / holiday? → 150% / 175% / 200%
                         │    else → 100% / 125% (first 2 h OT) / 150%   (or 100% if overtime is off)
                         ├─ per paid day: hours × rate snapshot × pay %
                         └─ domain/pay/payslip.ts
                              base pay + additions (travel, allowances) + one-off bonuses = gross
                              − mandatory (domain/tax/mandatory-deductions.ts):
                                  income tax (brackets) − credit points − locality credit
                                  national insurance (employee / self-employed, or exempt) + health
                              − voluntary: pension, study fund… (% of gross) + one-off deductions
                              = net
```

The estimate is not a payslip. It does not model annual tax coordination or employer-specific items. The monthly report also leaves out the tax credit for pension deposits.

The calculator (`/tools/calculator`, the Settings tab's action button) has two modes. **Hourly** is the original `quickSalaryEstimate`. **Global salary** is `globalSalaryEstimate` (`domain/pay/global-salary.ts`), a monthly payslip for an employee in Israel. It takes the base salary, global overtime, travel, convalescence pay, other taxable additions and taxable benefits. It applies income tax with the 35% pension credit (`pensionDepositCredit`), national and health insurance, the employee's pension and study-fund deposits, and taxes the employer's study-fund deposit above the ceiling as a benefit. It also returns the employer's deposits, the employer's national insurance and cost, and what was saved. Its yearly figures are in `ISRAEL_2026_PAYROLL_RULES`; add a new constant for a new year.

## UI stack

- **Styling:** Uniwind (Tailwind CSS v4 for React Native) + HeroUI Native. Theme tokens (`bg-surface`, `text-muted`, `bg-accent`…) are defined in `global.css` for light and dark mode. The theme is the same as Plutus.
- **Accent color and theme mode** are user settings, applied by `AppThemeController`.
- **Icons:** Material Symbols, rounded and filled, through `shared/ui/filled-icon.tsx`. Import each icon file directly to keep the bundle small.
- **Fonts:** Huninn via `@expo-google-fonts/huninn`, loaded in the root layout.
- **Layout:** edge-to-edge. Tab pages use `TabPage`, which pads for the status bar and the floating tab bar.

## Commands

```bash
npm start          # dev server
npm test           # unit + database integration tests (Node test runner)
npm run typecheck  # tsc --noEmit
npm run lint       # expo lint
npx expo-doctor    # dependency / config health
```


## Israeli holiday pay

Holiday dates are normalized from Hebcal's Israel calendar in `data/holidays/hebcal-client.ts`. Only Yom Tov and Independence Day qualify. `domain/holidays/` converts calendar events to premium windows in Asia/Jerusalem, merges overlapping intervals, and splits shift work by exact minute boundaries. The existing pay engine applies the higher effective rate, preserving overtime and rest-day rules without stacking identical premiums. Monthly workers receive only extra pay above their salary for normal hours.

Global `settings.holidayPay` selects automatic city-based entry/nightfall times or custom previous-day start / holiday-day end times. Independence Day uses 20:00–20:00 automatically; custom hours override it. Each shift keeps a copy of the holiday settings it was saved with (`shifts.holiday_pay_json`). After Save the user chooses whether this month's shifts take the change or only new shifts do; earlier months never change. Holiday cache refreshes still update live reports. Since breaks record only a duration, unpaid minutes are allocated at the end of a shift for holiday estimates; the settings and shift breakdown disclose this assumption.

`data/holidays/holiday-service.ts` loads every relevant year and deduplicates concurrent requests. The SQLite yearly cache is keyed by city (or dates-only), refreshes after 30 days, and falls back to stale data offline. Failed requests back off for one minute. Missing data yields a visible incomplete-estimate notice, never an invented holiday premium. Calendar requests send only year and chosen city coordinates; personal shift and salary data remain on-device. About credits and links to Hebcal. Regression tests include a public Hebcal 2026 Tel Aviv response snapshot.
