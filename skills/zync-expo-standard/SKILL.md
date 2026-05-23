---
name: zync-expo-standard
description: Use when building, extending, or creating new features in any ZyncGold Expo/React Native mobile app (msgld-app, zyncg-app, or any new app following the zync-expo standard). Triggers when user asks to add a module, create a screen, add a context, build a component, wire up GraphQL or REST, handle auth, or scaffold any feature in an Expo/React Native project within the ZyncGold ecosystem.
---

# Zync Expo Standard

## Core Principle

**Feature-based modules. Context owns state. Components are dumb. Data-fetching (Apollo or Axios/fetch) only inside `context.tsx` or `service.ts` — never in components or screens.**

Canonical reference: `/Users/sabiridwan/Projects/MalikStreams/msgold/msgld-app/`

---

## Stack

| Layer | Library |
|---|---|
| Framework | Expo 52+ + React Native, Expo Router (file-based `/app`) |
| Styling | NativeWind 4 (`className=`) + `StyleSheet` + `ApTheme` constants |
| **Data (GraphQL)** | Apollo Client 3 — `useLazyQuery`, `useMutation` |
| **Data (REST)** | Axios or `fetch` — called only from `service.ts` or `context.tsx` |
| Forms | Formik 2 + Yup |
| State | React Context only — no Redux, Zustand, MobX |
| Navigation | `expo-router` wrapped in `useApNavigation()` |
| Storage | `AsyncStorage` via `ApStorageService` only |
| Push | Firebase FCM (`@react-native-firebase/messaging`) |
| Upload | Apollo Upload Link (GraphQL) or `FormData` + Axios (REST) |
| Events | EventEmitter3 via `EventManager` |

**Choose one data layer per project (or per module).** The context pattern is identical — only the internals of `context.tsx` differ.

---

## Strict Layering

**GraphQL (Apollo):**
```
app/*.tsx (route file)
  └── <FeatureScreen />          ← thin: auth guard + mount only
        └── use<Feature>State()  ← context consumer
              └── context.tsx    ← owns ALL state + Apollo calls
                    └── use<Feature>Query()  ← Apollo hooks isolated here
                          └── gql/query.ts + gql/fragment.ts
```

**REST (Axios/fetch):**
```
app/*.tsx (route file)
  └── <FeatureScreen />          ← thin: auth guard + mount only
        └── use<Feature>State()  ← context consumer
              └── context.tsx    ← owns ALL state, calls service methods
                    └── service.ts  ← all Axios/fetch calls isolated here
```

**Rules (apply to both):**
- `app/*.tsx` route files: one line — render `<FeatureScreen />` + auth guard. No logic.
- All screen logic lives in `src/modules/<feat>/screen.tsx`
- Apollo hooks AND Axios/fetch ONLY inside `context.tsx` or `service.ts`
- Components call `use<Feature>State()` only — never import from `gql/` or `service.ts` directly
- If a component needs something the context doesn't expose, **extend the context**, don't bypass it

---

## Module File Layout

**GraphQL project:**
```
src/modules/<feature>/
  context.tsx          ← React Context: state + methods + Apollo wiring
  model.ts             ← TypeScript interfaces (IFeature, IFeatureState)
  screen.tsx           ← Main screen component
  [detail].tsx         ← Sub-screens (detail, form, pay, etc.)
  components/
    FeatureCard.tsx
  gql/
    query.ts           ← use<Feature>Query() returning all Apollo hooks
    fragment.ts        ← GraphQL fragments
  [submodule]/         ← Nest sub-features identically
```

**REST project:**
```
src/modules/<feature>/
  context.tsx          ← React Context: state + methods
  model.ts             ← TypeScript interfaces (IFeature, IFeatureState)
  service.ts           ← All Axios/fetch calls for this module
  screen.tsx           ← Main screen component
  [detail].tsx
  components/
    FeatureCard.tsx
  [submodule]/
```

---

## Context Pattern (Non-negotiable)

### model.ts — same for both

```typescript
export interface IFeature {
  _id: string;
  name: string;
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

### context.tsx — GraphQL variant

```typescript
const FeatureContext = createContext<IFeatureState>({} as IFeatureState);
export const useFeatureState = () => useContext(FeatureContext);

export const FeatureContextProvider = ({ children }: { children: ReactNode }) => {
  const { findFeature, createFeature } = useFeatureQuery(); // Apollo hooks here
  const [feature, setFeature] = useState<IFeature | null>(null);
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
      ApSuccessToast('Created successfully');
    }
  };

  return (
    <FeatureContext.Provider value={{ feature, loading, fetchFeature, createFeature: create, ... }}>
      {children}
    </FeatureContext.Provider>
  );
};
```

### context.tsx — REST variant

```typescript
const FeatureContext = createContext<IFeatureState>({} as IFeatureState);
export const useFeatureState = () => useContext(FeatureContext);

export const FeatureContextProvider = ({ children }: { children: ReactNode }) => {
  const [feature, setFeature] = useState<IFeature | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFeature = async (id: string) => {
    setLoading(true);
    try {
      const data = await featureService.getById(id); // service call, not fetch/axios directly
      setFeature(data);
    } catch (e) {
      ApErrorToast(e.message);
    } finally {
      setLoading(false);
    }
  };

  const create = async (input: ICreateFeature) => {
    try {
      await featureService.create(input);
      ApSuccessToast('Created successfully');
    } catch (e) {
      ApErrorToast(e.message);
    }
  };

  return (
    <FeatureContext.Provider value={{ feature, loading, fetchFeature, createFeature: create, ... }}>
      {children}
    </FeatureContext.Provider>
  );
};
```

### service.ts — REST variant only

```typescript
import { apiClient } from '@/services/api'; // shared Axios instance with auth header

export const featureService = {
  getById: async (id: string): Promise<IFeature> => {
    const { data } = await apiClient.get(`/feature/${id}`);
    return data;
  },
  create: async (input: ICreateFeature): Promise<IFeature> => {
    const { data } = await apiClient.post('/feature', input);
    return data;
  },
  update: async (id: string, input: IUpdateFeature): Promise<IFeature> => {
    const { data } = await apiClient.patch(`/feature/${id}`, input);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/feature/${id}`);
  },
};
```

### gql/fragment.ts + gql/query.ts — GraphQL variant only

```typescript
// fragment.ts
export const FeatureFragment = gql`
  fragment Feature on Feature {
    _id name createdAt
  }
`;

// query.ts — export ONE hook returning all Apollo hooks for this module
export const useFeatureQuery = () => ({
  findFeature: useLazyQuery(FIND_FEATURE, { fetchPolicy: 'cache-and-network' }),
  featurePage: useLazyQuery(FEATURE_PAGE),
  createFeature: useMutation(CREATE_FEATURE, { onError: (e) => ApErrorToast(errorSvc.graphQLError(e)) }),
  updateFeature: useMutation(UPDATE_FEATURE),
  deleteFeature: useMutation(DELETE_FEATURE),
});
```

---

## Provider Architecture

Same pattern for both GraphQL and REST — only the outer wrapper differs:

```typescript
// src/context/index.tsx
export const combineContext = (...components: FC[]) => {
  return components.reduce((Acc, Current) => ({ children }) => (
    <Acc><Current>{children}</Current></Acc>
  ));
};

// src/provider.tsx — GraphQL
export const ApProvider = ({ children }) => (
  <ApolloProvider client={client}>        {/* omit if REST-only project */}
    <AppContextProvider>
      {children}
    </AppContextProvider>
  </ApolloProvider>
);

// src/provider.tsx — REST-only
export const ApProvider = ({ children }) => (
  <AppContextProvider>
    {children}
  </AppContextProvider>
);
```

**When adding a new module:** register its `ContextProvider` inside `combineContext(...)` in `src/provider.tsx`.

---

## REST API Client Setup

For REST projects, create a shared Axios instance with auth injected:

```typescript
// src/services/api.ts
import axios from 'axios';
import { ApStorageService, ApStorageKeys } from './storage';

export const apiClient = axios.create({ baseURL: ENV.API_URL });

apiClient.interceptors.request.use(async (config) => {
  const auth = await ApStorageService.getItem(ApStorageKeys.Auth);
  if (auth?.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await AuthService.signout();
    }
    return Promise.reject(error);
  }
);
```

Never create a new Axios instance per module — always import `apiClient`.

---

## GraphQL Apollo Client Setup

```typescript
// src/apolloClient.tsx — extend, don't recreate
// chain: errorLink → authLink → uploadLink
// authLink: adds Bearer token + x-client-id header from ApStorageService
// errorLink: handles UNAUTHENTICATED → refresh token → retry
// uploadLink: handles multipart file uploads
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

All in `src/components/`. Always use `Ap` prefix.

**Inputs (all Formik-wired via `useField()`):**

| Component | Purpose |
|---|---|
| `ApTextInput` | Text / email, with password toggle variant |
| `ApPhoneInput` | Phone number with country code |
| `ApOtpInput` | OTP pin entry |
| `ApDropdown` | Select/dropdown |
| `ApCheckbox`, `ApToggle` | Boolean controls |
| `ApDateTimePicker` | Date + time picker |
| `ApCurrencyInput` | Formatted currency entry |
| `ApSearchInput` | Search bar with debounce |
| `ApLookupInput` | Async search with server lookup |
| `ApForm` | Formik `<Form>` wrapper |

**Layout / Containers:**

| Component | Purpose |
|---|---|
| `ApScreen` | Base screen wrapper — engagement tracking, requires `screenName` prop |
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
| `ApLoader` | Loading spinner |
| `ApEmptyState` | Empty list placeholder |
| `ApProgressBar` | Progress indicator |
| `ApRatingStar` | Star rating display |

**Always wrap screens with `<ApScreen screenName="feature-name">`** — tracks engagement automatically.

---

## Theme & Styling

```typescript
// src/theme.ts — never hardcode hex values
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

// Status badges: ApTheme.Status.[COMPLETED|PENDING|CANCELLED|INCOMPLETE]
// Each has: { bg, text, gradient }
```

**Styling approach (mix as needed):**
1. NativeWind: `className="flex-1 p-4 bg-white rounded-lg"` — preferred for layout
2. `StyleSheet.create({})` — complex or reusable style objects
3. Inline `style={{ color: ApTheme.Color.primary }}` — dynamic/token values

---

## Form Pattern

```typescript
const FormSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  amount: Yup.number().min(0).required(),
});

const MyForm = () => {
  const { createFeature } = useFeatureState();

  return (
    <Formik initialValues={{ name: '', amount: 0 }} validationSchema={FormSchema}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        await createFeature(values);
        resetForm();
        setSubmitting(false);
      }}>
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
// Always use useApNavigation() — never use expo-router hooks directly
const { navigate, replace, goBack, canGoBack } = useApNavigation();

navigate(AppRoute.CART);
navigate(AppRoute.ORDER_DETAIL, { orderId });
replace(AppRoute.MAIN);
goBack();
```

All routes live in `src/constants/index.ts` as the `AppRoute` enum. Add new routes there and create corresponding `app/<route>.tsx` files.

---

## Screen Structure

```typescript
// app/feature.tsx — stays thin
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

ApSuccessToast('Saved successfully');
ApErrorToast('Something went wrong');
ApInfoToast('Session expiring soon');

// GraphQL errors:
import { errorSvc } from '@/services/error';
ApErrorToast(errorSvc.graphQLError(e));

// REST errors (Axios):
ApErrorToast(e.response?.data?.message ?? e.message);
```

---

## Storage Service

```typescript
import { ApStorageService, ApStorageKeys } from '@/services/storage';

// Never use AsyncStorage directly in components or screens
await ApStorageService.setItem(ApStorageKeys.Auth, authData);
const auth = await ApStorageService.getItem(ApStorageKeys.Auth);
await ApStorageService.removeItem(ApStorageKeys.Auth);
```

---

## Event System

```typescript
import { EventManager } from '@/events';

EventManager.emit('signout', { signedout: true });
EventManager.addListener('signout', (data) => { /* handle */ });
EventManager.removeListener('signout', handler); // always cleanup in useEffect return
```

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Shared components | `Ap` prefix + PascalCase | `ApButton`, `ApFeatureCard` |
| Interfaces | `I` prefix | `ICart`, `ICartItem`, `ICartState` |
| State hooks | `use<Feature>State` | `useCartState()` |
| Query hooks (GQL) | `use<Feature>Query` | `useCartQuery()` |
| Service objects (REST) | `<feature>Service` | `cartService`, `orderService` |
| Navigation hook | `useApNavigation` | always this, never expo-router directly |
| GQL constants | `SCREAMING_SNAKE` | `USER_CART`, `CREATE_ORDER` |
| Files | kebab-case | `cart-item.tsx`, `feature.service.ts` |
| Screen component | `<Feature>Screen` | `CartScreen`, `OrderDetailScreen` |
| Route files | `app/<route>.tsx` | `app/cart.tsx` |
| Module dirs | `src/modules/<feature>/` | `src/modules/cart/` |

---

## Adding a New Module — Checklist

**GraphQL:**
1. `model.ts` — `IFeat`, `IFeatState`
2. `gql/fragment.ts` — GraphQL fragment
3. `gql/query.ts` — `use<Feat>Query()` returning all Apollo hooks
4. `context.tsx` — `<Feat>ContextProvider` + `use<Feat>State()`
5. Register in `src/provider.tsx` → `combineContext()`
6. `screen.tsx` — wraps with `<ApScreen>`, consumes `use<Feat>State()`
7. `app/<route>.tsx` — thin route file
8. Add to `AppRoute` enum in `src/constants/index.ts`
9. New shared components → `src/components/Ap<Name>.tsx`

**REST (replace steps 2–3):**
2. `service.ts` — all Axios calls via shared `apiClient`
3. `context.tsx` — calls `featureService.*` methods, never Axios directly

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Calling `useMutation` / `axios` in a screen or component | Move to `context.tsx` or `service.ts` |
| Using `AsyncStorage` directly | Use `ApStorageService` |
| Hardcoding hex colors | Use `ApTheme.Color.*` |
| Using `expo-router` hooks directly in screens | Use `useApNavigation()` |
| Business logic in `app/*.tsx` route file | Move to `src/modules/<feat>/screen.tsx` |
| New shared component without `Ap` prefix | Always prefix with `Ap` |
| Context provider not in `provider.tsx` | Add to `combineContext()` |
| Creating a new Axios instance per module | Import shared `apiClient` from `services/api.ts` |
| Error toast from inside `gql/query.ts` or `service.ts` | Handle errors in `context.tsx`, not in the data layer |
