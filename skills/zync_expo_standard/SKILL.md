---
name: zync_expo_standard
description: Use when building, extending, or creating new features in any ZyncGold Expo/React Native mobile app (msgld-app, zyncg-app, or any new app following the zync-expo standard). Triggers when user asks to add a module, create a screen, add a context, build a component, wire up GraphQL, handle auth, or scaffold any feature in an Expo/React Native project within the ZyncGold ecosystem.
---

# Zync Expo Standard

## Core Principle

**Feature-based modules. Context owns state. Components are dumb. Apollo hooks only inside `context.tsx` or `service.ts`.**

Canonical reference: `/Users/sabiridwan/Projects/MalikStreams/msgold/msgld-app/`

---

## Stack

| Layer | Library |
|---|---|
| Framework | Expo 52+ + React Native, Expo Router (file-based `/app`) |
| Styling | NativeWind 4 (`className=`) + `StyleSheet` + `ApTheme` constants |
| GraphQL | Apollo Client 3 — `useLazyQuery`, `useMutation` |
| Forms | Formik 2 + Yup |
| State | React Context only — no Redux, Zustand, MobX |
| Navigation | `expo-router` wrapped in `useApNavigation()` |
| Storage | `AsyncStorage` via `ApStorageService` only |
| Push | Firebase FCM (`@react-native-firebase/messaging`) |
| Upload | Apollo Upload Link (multipart FormData) |
| Events | EventEmitter3 via `EventManager` |

---

## Strict Layering

```
app/*.tsx (route file)
  └── <FeatureScreen />          ← thin: auth guard + mount only
        └── use<Feature>State()  ← context consumer
              └── context.tsx    ← owns ALL state + Apollo calls
                    └── use<Feature>Query()  ← Apollo hooks isolated here
                          └── gql/query.ts + gql/fragment.ts
```

**Rules:**
- `app/*.tsx` route files: one line — render `<FeatureScreen />` + auth guard. No logic.
- All screen logic lives in `src/modules/<feat>/screen.tsx`
- Apollo (`useLazyQuery`, `useMutation`) ONLY inside `context.tsx` or `service.ts`
- Components call `use<Feature>State()` only — never import from `gql/`, never call `fetch`/`axios`/`useMutation` directly
- If a component needs something not exposed by the context, **extend the context**, don't bypass it

---

## Module File Layout

```
src/modules/<feature>/
  context.tsx          ← React Context: state + methods + Apollo wiring
  model.ts             ← TypeScript interfaces (IFeature, IFeatureState)
  screen.tsx           ← Main screen component
  [detail].tsx         ← Sub-screens (detail, form, pay, etc.)
  components/
    FeatureCard.tsx    ← PascalCase
    FeatureList.tsx
  gql/
    query.ts           ← use<Feature>Query() returning all Apollo hooks
    fragment.ts        ← GraphQL fragments
  [submodule]/         ← Nest sub-features identically
    context.tsx
    model.ts
    gql/
```

---

## Context Pattern (Non-negotiable)

### model.ts

```typescript
export interface IFeature {
  _id: string;
  name: string;
  // ... data shape
}

export interface IFeatureState {
  feature: IFeature | null;
  list: IFeature[];
  loading: boolean;
  fetchFeature: (id: string) => Promise<void>;
  createFeature: (input: ICreateFeature) => Promise<void>;
  updateFeature: (id: string, input: IUpdateFeature) => Promise<void>;
  deleteFeature: (id: string) => Promise<void>;
}
```

### gql/fragment.ts

```typescript
export const FeatureFragment = gql`
  fragment Feature on Feature {
    _id
    name
    createdAt
  }
`;
```

### gql/query.ts

```typescript
const FIND_FEATURE = gql`
  query findFeature($id: ID!) {
    findFeature(id: $id) { ...Feature }
  }
  ${FeatureFragment}
`;

const FEATURE_PAGE = gql`
  query featurePage($input: FeaturePageInput!) {
    featurePage(input: $input) { data { ...Feature } total page limit }
  }
  ${FeatureFragment}
`;

const CREATE_FEATURE = gql`
  mutation createFeature($input: CreateFeatureInput!) {
    createFeature(input: $input) { ...Feature }
  }
  ${FeatureFragment}
`;

// Export ONE hook that returns all Apollo hooks for this module
export const useFeatureQuery = () => ({
  findFeature: useLazyQuery(FIND_FEATURE, { fetchPolicy: 'cache-and-network' }),
  featurePage: useLazyQuery(FEATURE_PAGE),
  createFeature: useMutation(CREATE_FEATURE, { onError: (e) => ApErrorToast(errorSvc.graphQLError(e)) }),
  updateFeature: useMutation(UPDATE_FEATURE),
  deleteFeature: useMutation(DELETE_FEATURE),
});
```

### context.tsx

```typescript
const FeatureContext = createContext<IFeatureState>({} as IFeatureState);

export const useFeatureState = () => useContext(FeatureContext);

export const FeatureContextProvider = ({ children }: { children: ReactNode }) => {
  const { findFeature, featurePage, createFeature, updateFeature, deleteFeature } = useFeatureQuery();
  const [feature, setFeature] = useState<IFeature | null>(null);
  const [list, setList] = useState<IFeature[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFeature = async (id: string) => {
    setLoading(true);
    const [query] = findFeature;
    const { data } = await query({ variables: { id } });
    if (data?.findFeature) setFeature(data.findFeature);
    setLoading(false);
  };

  const create = async (input: ICreateFeature) => {
    const [mutate] = createFeature;
    const { data } = await mutate({ variables: { input } });
    if (data?.createFeature) {
      setList(prev => [data.createFeature, ...prev]);
      ApSuccessToast('Created successfully');
    }
  };

  return (
    <FeatureContext.Provider value={{ feature, list, loading, fetchFeature, createFeature: create, ... }}>
      {children}
    </FeatureContext.Provider>
  );
};
```

---

## Provider Architecture

All contexts registered in `src/provider.tsx` via `combineContext()`:

```typescript
// src/context/index.tsx
export const combineContext = (...components: FC[]) => {
  return components.reduce((Acc, Current) => ({ children }) => (
    <Acc><Current>{children}</Current></Acc>
  ));
};

// src/provider.tsx
const AppContextProvider = combineContext(
  AuthContextProvider,
  ProfileContextProvider,
  CartContextProvider,
  FeatureContextProvider, // ← add new modules here
  // ... 30+ providers
);

export const ApProvider = ({ children }) => (
  <ApolloProvider client={client}>
    <AppContextProvider>
      <ServerStatusWrapper>{children}</ServerStatusWrapper>
    </AppContextProvider>
  </ApolloProvider>
);
```

**When adding a new module:** export its `ContextProvider` and add to `combineContext(...)` in `src/provider.tsx`.

---

## Apollo Client Setup

```typescript
// src/apolloClient.tsx — do not recreate, extend this file
const authLink = new ApolloLink((operation, forward) => {
  const token = await ApStorageService.getItem(ApStorageKeys.Auth);
  operation.setContext({ headers: {
    'x-client-id': ENV.CLIENT_ID,
    authorization: token ? `Bearer ${token.accessToken}` : '',
  }});
  return forward(operation);
});

// error link handles UNAUTHENTICATED → refresh token → retry
// upload link handles multipart file uploads
// chain: errorLink → authLink → uploadLink
```

---

## Auth Flow

1. `authCheck(phoneNumber)` → returns `IAuthCheck` (isRegistered, hasProfile, etc.)
2. `otpSignIn(phone)` → sends OTP
3. `otpVerify(phone, otp)` → validates, returns tokens
4. Store tokens: `ApStorageService.setItem(ApStorageKeys.Auth, IAuthData)`
5. Token refresh: 60s interval checks expiry, calls `AuthService.refreshTokenAsync()`
6. Signout: `AuthService.signout()` → clears storage → `EventManager.emit('signout')`

**Never** access `AsyncStorage` directly from components. Always go through `AuthService` or `ApStorageService`.

---

## Shared Components (Ap* Prefix)

All in `src/components/`. Always use `Ap` prefix. New shared components go here.

**Inputs (all Formik-wired via `useField()`):**

| Component | Purpose |
|---|---|
| `ApTextInput` | Text / email, with password toggle variant |
| `ApPhoneInput` | Phone number with country code |
| `ApOtpInput` | OTP pin entry |
| `ApDropdown` | Select/dropdown (element-dropdown) |
| `ApCheckbox`, `ApToggle` | Boolean controls |
| `ApDateTimePicker` | Date + time picker |
| `ApCurrencyInput` | Formatted currency entry |
| `ApSearchInput` | Search bar with debounce |
| `ApLookupInput` | Async search with server lookup |
| `ApForm` | Formik `<Form>` wrapper |

**Layout / Containers:**

| Component | Purpose |
|---|---|
| `ApScreen` | Base screen wrapper — engagement tracking, screenName prop |
| `ApScrollView` | Scrollable container |
| `ApSafeAreaView` | SafeAreaView wrapper |
| `ApKeyboardAvoidingView` | Keyboard dismiss handling |
| `ApCard`, `ApSegment` | Content cards |
| `ApContainer`, `ApDivider` | Layout primitives |
| `ApBottomSheet` | Bottom sheet modal |
| `ApModal`, `ApConfirmModal` | Modals |
| `ApFooter` | Sticky bottom action bar |

**Display:**

| Component | Purpose |
|---|---|
| `ApButton` | Variants: `primary`, `secondary`, `link`, `black`, `danger`, `light`, `outline` |
| `ApText` | Typography with font/size/color props |
| `ApIcon` | Icon wrapper |
| `ApImage`, `ApImageViewer` | Images with loading states |
| `ApImagePicker` | Camera/gallery picker |
| `ApCarousel` | Swipeable image carousel |
| `ApFlatList`, `ApSectionList` | Lists with empty state |
| `ApTable` | Tabular data |
| `ApLoader` | Loading spinner |
| `ApEmptyState` | Empty list placeholder |
| `ApProgressBar` | Progress indicator |
| `ApRatingStar` | Star rating display |

**Always wrap new screens with `<ApScreen screenName="feature-name">`** — it tracks engagement automatically.

---

## Theme & Styling

```typescript
// src/theme.ts — use these, never hardcode hex values
ApTheme.Color.primary    // #C07D34 (gold)
ApTheme.Color.secondary  // #FFBE4F
ApTheme.Color.success    // #076E4B
ApTheme.Color.danger     // #FF5860
ApTheme.Color.dark       // #555555
ApTheme.Color.muted      // #A0A0A0
ApTheme.Color.bgLight    // #F5F5F5

ApFont.Bold, ApFont.Medium, ApFont.SemiBold, ApFont.Light
ApFont.Poppins, ApFont.PoppinsMedium, ApFont.PoppinsBold
ApFont.Playfair  // headings / branding

// Status badges use ApTheme.Status.[COMPLETED|PENDING|CANCELLED|INCOMPLETE]
// Each has: { bg, text, gradient }
```

**Styling approach (all three are used — mix as needed):**
1. NativeWind: `className="flex-1 p-4 bg-white rounded-lg"` — preferred for layout
2. `StyleSheet.create({})` — for complex styles or reusable style objects
3. Inline `style={{ color: ApTheme.Color.primary }}` — for dynamic/token values

---

## Form Pattern

```typescript
const FormSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  amount: Yup.number().min(0).required(),
});

const MyForm = () => {
  const { createFeature } = useFeatureState();

  const handleSubmit = async (values: IFormValues, { setSubmitting, resetForm }) => {
    await createFeature(values);
    resetForm();
    setSubmitting(false);
  };

  return (
    <Formik initialValues={{ name: '', amount: 0 }} validationSchema={FormSchema} onSubmit={handleSubmit}>
      {(formik) => (
        <ApForm onSubmit={formik.handleSubmit}>
          <ApTextInput label="Name" name="name" />
          <ApCurrencyInput label="Amount" name="amount" />
          <ApButton title="Submit" loading={formik.isSubmitting} onPress={formik.handleSubmit} />
        </ApForm>
      )}
    </Formik>
  );
};
```

All `Ap*Input` components connect to Formik via `useField(name)` internally — no manual field wiring needed.

---

## Navigation

```typescript
// Always use useApNavigation() — never use expo-router hooks directly in screens
const { navigate, replace, goBack, canGoBack } = useApNavigation();

navigate(AppRoute.CART);                          // push
navigate(AppRoute.ORDER_DETAIL, { orderId });     // push with params
replace(AppRoute.MAIN);                           // replace current
goBack();
```

**Route constants:** All routes live in `src/constants/index.ts` as the `AppRoute` enum.
When adding a new screen: add its route to `AppRoute` and create `app/<route>.tsx` file.

---

## Screen Structure

```typescript
// app/feature.tsx — route file, stays thin
export default function FeaturePage() {
  return <FeatureScreen />;
}

// src/modules/feature/screen.tsx — all logic here
export const FeatureScreen = () => {
  const { navigate } = useApNavigation();
  const { feature, loading, fetchFeature } = useFeatureState();

  useEffect(() => { fetchFeature(id); }, []);

  return (
    <ApScreen screenName="feature">
      <ApScrollView>
        {loading ? <ApLoader /> : (
          <>
            <FeatureCard data={feature} />
            <ApButton title="Continue" onPress={() => navigate(AppRoute.NEXT)} />
          </>
        )}
      </ApScrollView>
    </ApScreen>
  );
};
```

---

## Toast Notifications

```typescript
import { ApSuccessToast, ApErrorToast, ApInfoToast } from '@/components/ApToast';

ApSuccessToast('Order placed successfully');
ApErrorToast('Payment failed. Please try again.');
ApInfoToast('Your session will expire soon');

// For GraphQL errors:
import { errorSvc } from '@/services/error';
onError: (e) => ApErrorToast(errorSvc.graphQLError(e))
```

---

## Storage Service

```typescript
import { ApStorageService, ApStorageKeys } from '@/services/storage';

// Always use ApStorageService — never AsyncStorage directly in components
await ApStorageService.setItem(ApStorageKeys.Auth, authData);
const auth = await ApStorageService.getItem(ApStorageKeys.Auth);
await ApStorageService.removeItem(ApStorageKeys.Auth);

// Keys: Auth, ExternalAuth, RatePertUnit, Coords, FcmToken, IsUpdateSignout
```

---

## Event System

```typescript
import { EventManager } from '@/events';

EventManager.emit('signout', { signedout: true });
EventManager.addListener('signout', (data) => { /* handle */ });
EventManager.removeListener('signout', handler); // cleanup in useEffect return
```

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Shared components | `Ap` prefix + PascalCase | `ApButton`, `ApFeatureCard` |
| Interfaces | `I` prefix | `ICart`, `ICartItem`, `ICartState` |
| State hooks | `use<Feature>State` | `useCartState()` |
| Query hooks | `use<Feature>Query` | `useCartQuery()` |
| Navigation hook | `useApNavigation` | always this |
| GQL constants | `SCREAMING_SNAKE` | `USER_CART`, `CREATE_ORDER` |
| Files | kebab-case | `cart-item.tsx`, `order.model.ts` |
| Screen component | `<Feature>Screen` | `CartScreen`, `OrderDetailScreen` |
| Route files | `app/<route>.tsx` | `app/cart.tsx` |
| Module dirs | `src/modules/<feature>/` | `src/modules/cart/` |

---

## Adding a New Module — Checklist

1. Create `src/modules/<feat>/model.ts` — define `IFeat`, `IFeatState`
2. Create `src/modules/<feat>/gql/fragment.ts` — GraphQL fragment
3. Create `src/modules/<feat>/gql/query.ts` — `use<Feat>Query()` returning all hooks
4. Create `src/modules/<feat>/context.tsx` — `<Feat>ContextProvider` + `use<Feat>State()`
5. Register in `src/provider.tsx` inside `combineContext()`
6. Create `src/modules/<feat>/screen.tsx` — calls `use<Feat>State()`, wraps with `<ApScreen>`
7. Create `app/<route>.tsx` — thin route file importing `<FeatScreen>`
8. Add route constant to `AppRoute` enum in `src/constants/index.ts`
9. New shared components → `src/components/Ap<Name>.tsx`

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Calling `useMutation` inside a screen component | Move to `context.tsx` → `use<Feature>Query()` |
| Using `AsyncStorage` directly | Use `ApStorageService` |
| Hardcoding hex colors | Use `ApTheme.Color.*` |
| Using `expo-router` hooks directly in screens | Use `useApNavigation()` |
| Business logic in route file (`app/*.tsx`) | Move to `src/modules/<feat>/screen.tsx` |
| New shared component without `Ap` prefix | Always prefix with `Ap` |
| Context provider not registered in `provider.tsx` | Add to `combineContext()` |
| Showing toast from gql/query.ts | Move error handling to context or use `onError` in mutation options |
