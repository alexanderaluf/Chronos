This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Chronos structure (read before adding code)

Full guide: [docs/architecture.md](docs/architecture.md). Database guide: [docs/database.md](docs/database.md).

- `src/app/` routes only → `src/features/<area>/` screens → `src/data/` SQLite → `src/domain/` pure rules. `src/shared/` holds reusable UI, theme and navigation. Imports point only in that direction; `shared/` never imports `features/`.
- Money is integer minor units, percentages are integer basis points, and times are ISO UTC strings. Pay and tax are calculated only in `src/domain/` and tested in `src/domain/domain.test.ts` (`npm test`).
- SQL lives only in `src/data/repositories/`. Every write goes through `writeTransaction`. Schema changes are new, append-only migrations in `src/data/database/migrations.ts`. Cover repository changes in `src/data/data.test.ts` (real SQLite in Node).
- Every pushed screen is built from the Plutus-style kit in `src/shared/ui/form`. That means `FormScreen` for the page, `InputCard` / `PickerCard` / `ToggleCard` / `SelectionSection` for the main fields (see the shift editor), and `FormSection` rows for settings. The kit already follows the platform UI policy below.
- Hourly rate and bonus per shift are global (Salary settings, stored on the job). New shifts copy them, and a shift can override them ("Custom"). Each shift keeps its own copy, so history never changes.
- If `tsc` reports route errors listing `/../domain/...` paths, the running dev server wrote a stale `.expo/types/router.d.ts`. Restart `expo start`.
- Styling: Uniwind + HeroUI Native with theme tokens from `global.css` (same theme as Plutus). Use the `heroui-native` skill before adding HeroUI components.
- Before finishing: `npm test`, `npm run typecheck`, `npm run lint`.

## Localization: English, Hebrew (RTL), Russian (MANDATORY)

Chronos ships in **en**, **he** and **ru**, using the same i18next setup as Plutus (`src/localization/`).

- **Never hard-code user-facing text.** Add the English string to `src/localization/locales/en.ts`, then the same key to `he.ts` and `ru.ts`.
  - Both translation files are typed as `Translation`, so a missing key is a type error.
  - `src/localization/localization.test.ts` also checks key parity and `{{placeholders}}`.
- In components, use `const { t } = useTranslation()`. A plain `i18n.t` call does not re-render when the language changes, because the React Compiler memoizes components. `i18n.t` is only for non-React code: formatters, error messages, report text.
- **Hebrew is RTL; English and Russian are LTR.** `LocalizationProvider` applies the direction to the whole app immediately (root `direction` style + Uniwind `LayoutDirection` + HeroUI `isRTL`). It also calls `I18nManager.forceRTL`, so native views match after a restart. Rules for layout code:
  - Use logical styles: `ms-*` / `me-*` / `ps-*` / `pe-*` / `start` / `end`, never left/right.
  - Read direction from `useAppLocalization().isRTL`, not `I18nManager.isRTL`, which only changes after a restart.
  - Transforms (`translateX`) and directional icons are not mirrored automatically. Flip them using `isRTL` (see `FilledIcon` `rtlIcons`, `AppSwitch`).
  - Use the app `Text` (it aligns to the reading direction).
- **Dates and numbers** format with `getAppLocale()` (`shared/lib/format.ts`): the app language plus the device region. Use the `format*` helpers, not raw `toLocale*` with the device locale.
- **The domain stays language-free.** It returns codes and keys (payslip line `key`, credit-point `code`, `DataValidationError.code`). The UI translates them with `src/localization/labels.ts` and `errorMessage()`.
- **The language setting** is `settings.appLanguage`: `null` = follow the device. The user changes it in General settings.

## Platform UI policy (MANDATORY)

Three kinds of UI, three rules. This overrides the skills: the `expo-ui` "use @expo/ui by default" advice applies to **iOS system components and date/time pickers only**.

1. **Plutus design elements:** the same custom component on **both** platforms. Chronos uses the Plutus design system (`../budget-tracker`, its transaction editor and settings pages), so this includes:
   - the page shell and header (`FormScreen`, `ScreenHeader`: back arrow + bold title, floating Save dock),
   - `GlassSegmentedControl`,
   - the cards (`InputCard`, `PickerCard`, `ToggleCard`),
   - `SelectionSection`,
   - settings rows (`LinkRow` with pastel icon tiles),
   - grouped sections (`FormSection`, `rounded-[28px]`).

   The native stack header is never shown: `headerShown: false` in the root layout. For a new design element, port it from Plutus first.
2. **Date and time pickers:** native on **both** platforms: a SwiftUI popover on iOS, the Material dialog on Android. Always use `DateTimePickerOverlay` through `PickerCard`, `DateField` or `TimeField`. This is the **only** native UI Android may use.
3. **Other system components** (bottom sheets, alerts, switches, spinners, menus): **iOS native, Android custom**.
   - **iOS** uses the native component in a `*.ios.tsx` file.
   - **Android** gets a version **built from scratch** in the default `*.tsx` file, using React Native primitives, Reanimated and Gesture Handler. Do not use HeroUI for this replacement.
   - Both files share one props type in `*.types.ts` and export the same name. Screens import the extension-less path (e.g. `@/shared/ui/overlay/app-bottom-sheet`), and Metro picks the right file.

### When a needed component is not covered above (follow in order)

1. **A native iOS component exists:** follow rule 3 (iOS native, Android from scratch).
2. **No native component:** check the `heroui-native` skill (`node .claude/skills/heroui-native/scripts/list_components.mjs`). If HeroUI Native has it, use it on **both** platforms.
3. **Not in HeroUI either:** build it from scratch, once, for **both** platforms, in the Plutus style.

### Never on Android

- `@expo/ui` in any form, **except** the date/time dialog in `shared/ui/controls/date-time-picker-overlay.tsx`. This rules out the universal components (they render Jetpack Compose on Android), `@expo/ui/jetpack-compose`, and the other `@expo/ui/community/*` drop-ins. Elsewhere, import `@expo/ui` **only** inside `*.ios.tsx` files.
- React Native `Modal`, `Alert.alert`, `Switch`, or `ActivityIndicator`.
- Native-stack `presentation: "formSheet" | "modal" | "transparentModal"` for UI, or the native header/toolbar.
- Native menus or context menus.

### Allowed on both platforms

React Native primitives (`View`, `Text`, `TextInput`, `ScrollView`, `FlatList`, `Pressable`, `Image`), Reanimated, Gesture Handler, `expo-blur` / `expo-linear-gradient` visual effects, stack navigation transitions, system bars, and the system share sheet (`Share.share`, an OS feature with no in-app alternative).

### Existing platform components (always use these)

| Need | Use | iOS | Android |
| --- | --- | --- | --- |
| Pushed page | `FormScreen` (`shared/ui/form`) | Plutus shell (custom) | Same |
| Header | `ScreenHeader` | Plutus header (custom) | Same |
| Segmented control | `GlassSegmentedControl` / `SegmentedField` | Plutus glass pill (custom) | Same |
| Main inputs | `InputCard`, `PickerCard`, `ToggleCard`, `SelectionSection` | Plutus cards (custom) | Same |
| Date / time | `PickerCard`, `DateField`, `TimeField` → `DateTimePickerOverlay` | **Native** SwiftUI popover | **Native** Material dialog |
| Bottom sheet | `AppBottomSheet` (`shared/ui/overlay`) | Native SwiftUI sheet (Liquid Glass) | Custom: drag, backdrop, back button |
| Alert / confirm | `AppAlert.alert(...)` | Native `Alert` | Custom dialog (`AppAlertHost`) |
| Switch | `AppSwitch` (`shared/ui/controls`) | Native SwiftUI toggle | Custom animated toggle |
| Loading spinner | `AppSpinner` | Native `ActivityIndicator` | Custom rotating ring |

- Never call `Alert.alert` directly. Use `AppAlert.alert` (same arguments).
- Android overlays render through `Portal` (`shared/ui/overlay/portal.tsx`), mounted in the root layout. Portal content does not see contexts between the root and where it is written, so use the global `router`, not navigation hooks, inside it.
- Every Android overlay must close with the system back button (`BackHandler`) and support Reduce Motion (`ReduceMotion.System`).
- Never put platform extensions on route files in `src/app/`. Split components in `src/shared/` or `src/features/` instead.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
