# LinkReel — End-to-End System Design & Implementation Specification

---

## 1. Executive Summary & Autonomous Execution Directives

**LinkReel** is an AI-powered iOS mobile application engineered with **React Native (Expo)** and a **Google Cloud Platform (GCP)** backend. It autonomously ingests any public website URL, extracts branding and visual assets, synthesizes a high-retention marketing script using **Gemini 2.0 Flash**, generates studio-grade narration with **Google Cloud Text-to-Speech (Neural2)**, and renders a 30-second motion graphics video in under 60 seconds using **Remotion**.

### 1.1 Autonomous Execution Protocol & Token Optimization
- **Full Autonomous Execution:** The agent implements all components end-to-end without requiring manual intervention for routine operations.
- **Token Efficiency:** Operations are streamlined with minimal intermediate conversational output, focused file edits, and concise diagnostic runs.
- **Dynamic Ledger Updates:** As each infrastructure resource or software module is completed, the agent updates [IMPLEMENTATION_TRACKING.md](file:///c:/Users/senth/OneDrive/Documents/LinkReel/IMPLEMENTATION_TRACKING.md).
- **Session & Boundary Resilience:** If token boundaries or system interruptions occur, implementation resumes automatically from the last documented checkpoint.
- **Consolidated Final Reporting:** A comprehensive final report with all direct GCP console links, Firestore DB instances, test suite outputs, and video render artifacts is provided upon completion.

### 1.2 Required Details, Credentials & Technical Purpose Table

| Detail / Credential | Status & Source | Exact Purpose in LinkReel |
| :--- | :--- | :--- |
| **GCP Billing Account** | `018700-A17A0F-725A86` (Auto-linked) | Enables Cloud Run, Cloud Tasks, Firestore, and GCS in the new isolated project. |
| **GCP Project ID** | `linkreel-app-prod-<id>` (Auto-created) | Isolated container ensuring complete separation from existing GCP assets. |
| **Cloud Firestore DB** | Native Mode `nam5` (Auto-created) | Real-time database for user profiles, credit deductions, and live job status listeners. |
| **Gemini 2.0 API / ADC** | GCP Generative AI API (Auto-enabled) | Analyzes website content and structures 30s marketing storyboards in JSON. |
| **Google Cloud TTS API** | GCP Text-to-Speech (Auto-enabled) | Synthesizes Neural2 voiceovers with word-level timecode alignment for subtitles. |
| **Firebase iOS Config** | `GoogleService-Info.plist` (Auto-generated) | Connects Expo iOS app to Firestore for real-time video generation updates. |
| **RevenueCat Apple Key** | Optional (Mocked for Dev / Real for Prod) | Manages in-app subscriptions and credit purchases via StoreKit 2. |
| **Apple Dev Team ID** | Optional (For App Store release build) | Signs the native `.ipa` iOS binary during EAS production builds. |

---

## 2. System Architecture & Component Interactions

```
 ┌─────────────────────────────────────────────────────────────┐
 │                      iOS CLIENT APP                         │
 │               (React Native / Expo + TypeScript)            │
 └──────────────────────┬──────────────────────────────▲───────┘
                        │ 1. POST /api/v1/jobs         │ 7. Realtime Sync
                        │    (with Idempotency Key)    │    (Firestore Listener)
                        ▼                              │
 ┌─────────────────────────────────────────────────────┴───────┐
 │               GOOGLE CLOUD RUN (API Gateway)                │
 │               Node.js / Express / Fastify + TypeScript       │
 └──────────────────────┬──────────────────────────────────────┘
                        │ 2. Deduct Credit (Firestore Tx)
                        │ 3. Enqueue Job
                        ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                     GOOGLE CLOUD TASKS                      │
 │                 (Deduplicated Task Queue)                   │
 └──────────────────────┬──────────────────────────────────────┘
                        │ 4. Dispatch Worker
                        ▼
 ┌─────────────────────────────────────────────────────────────┐
 │             LINKREEL ORCHESTRATION PIPELINE                 │
 │                                                             │
 │   a. Headless Scraper (Playwright / Chromium)               │
 │      ├── Retina 4K full-page & section screenshots          │
 │      ├── DOM Title, Description & OpenGraph metadata        │
 │      └── CSS Palette extraction (Brand / Accent colors)     │
 │                                                             │
 │   b. AI Storyboard Engine (Gemini 2.0 Flash)                │
 │      └── Structured JSON Schema (Hook, 4 Scenes, CTAs)      │
 │                                                             │
 │   c. Audio Synthesis (Google Cloud Text-to-Speech)          │
 │      ├── High-fidelity Neural2 voiceover                    │
 │      └── Timestamp alignment for kinetic subtitles          │
 │                                                             │
 │   d. Video Render Engine (Remotion Headless on Cloud Run)   │
 │      ├── 3D device frames, spring physics, cursor motion    │
 │      └── Multi-aspect rendering (9:16, 1:1, 16:9)           │
 └──────────────────────┬──────────────────────────────┬───────┘
                        │                              │
                        ▼                              ▼
 ┌──────────────────────────────┐              ┌───────────────┐
 │  Google Cloud Storage (GCS)  │              │Cloud Firestore│
 │  ├── Temporary raw assets    │              │  (Job status, │
 │  │   (7-day lifecycle rule)  │              │   User states,│
 │  └── Rendered MP4 outputs    │              │   Credits)    │
 └──────────────────────────────┘              ┌───────────────┘
```

---

## 3. Dedicated Google Cloud Platform (GCP) Configuration & Isolation Policy

> [!IMPORTANT]
> **Strict Project Isolation Requirement:** A completely **NEW, DEDICATED GCP Project** must be created specifically for LinkReel. **Do NOT reuse or share any existing Google Cloud project or existing Firebase/Firestore database.**

### 3.1 New Project Provisioning
- **GCP Console:** [https://console.cloud.google.com/](https://console.cloud.google.com/)
- **Suggested Project Name / ID:** `linkreel-app-prod` (or `linkreel-ios-prod`)
- **Primary Region:** `us-central1` (low latency, full Gemini 2.0 Flash & Cloud Run availability)

```bash
# 1. Create a fresh dedicated project (or via Google Cloud Console UI)
gcloud projects create linkreel-app-prod --name="LinkReel App Production"

# 2. Link active billing account to the new project
# (Replace BILLING_ACCOUNT_ID with active billing ID)
gcloud beta billing projects link linkreel-app-prod --billing-account=BILLING_ACCOUNT_ID

# 3. Set local gcloud context to the new project
gcloud config set project linkreel-app-prod
```

### 3.2 Dedicated Firestore Database Provisioning (Native Mode)
- **Firestore Console:** [https://console.cloud.google.com/firestore](https://console.cloud.google.com/firestore)
- **Database Type:** **Native Mode** (Required for real-time mobile client listeners)
- **Database ID:** `(default)`
- **Location / Region:** `nam5` (us-central1 multi-region) or `us-central1`

```bash
# Provision fresh Firestore Native database in us-central1
gcloud firestore databases create \
  --location=nam5 \
  --type=firestore-native
```

### 3.3 Required APIs & Service Enablement
Run once on the newly created project:
```bash
gcloud services enable \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  firestore.googleapis.com \
  texttospeech.googleapis.com \
  generativelanguage.googleapis.com \
  storage.googleapis.com \
  storage-component.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com
```

### 3.4 Google Cloud Storage (GCS) Buckets & Lifecycle Rules
1. **`gs://linkreel-temp-assets`**:
   - Stores Playwright screenshots and raw TTS audio.
   - **Lifecycle Rule:** Auto-delete all objects after **7 days** to eliminate long-term storage bills.
2. **`gs://linkreel-public-videos`**:
   - Stores final rendered `.mp4` video files.
   - Served with public signed URLs or CDN endpoints with Cache-Control headers.

---

## 4. Firestore Database Architecture & Concurrency Model

### 4.1 Schema Definition

```typescript
// users/{userId}
export interface UserDocument {
  uid: string;
  email: string;
  plan: 'free' | 'starter' | 'pro';
  creditsRemaining: number;
  totalVideosCreated: number;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// video_jobs/{jobId}
export interface VideoJobDocument {
  id: string;
  userId: string;
  idempotencyKey: string; // Prevents accidental double-submission
  inputUrl: string;
  aspectRatio: '9:16' | '1:1' | '16:9';
  stylePreset: 'saas_dark' | 'ecommerce_punchy' | 'minimal_editorial';
  voiceId: 'en-US-Neural2-F' | 'en-US-Neural2-D';
  
  // Real-Time Progress Machine
  status: 'queued' | 'scraping' | 'scripting' | 'generating_audio' | 'rendering' | 'completed' | 'failed';
  progress: number; // 0 to 100
  
  // Structured Error Tracking
  error?: {
    code: 'INVALID_URL' | 'PAYWALL_DETECTED' | 'SCRAPE_TIMEOUT' | 'TTS_FAILURE' | 'RENDER_FAILURE' | 'INSUFFICIENT_CREDITS';
    title: string;
    message: string;
    canRetry: boolean;
  };
  
  // Extracted Assets
  branding?: {
    title: string;
    description: string;
    brandColor: string;
    logoUrl?: string;
    heroScreenshotUrl: string;
    featureScreenshotUrls: string[];
  };
  
  // AI Storyboard
  script?: {
    hook: string;
    fullNarration: string;
    scenes: Array<{
      id: number;
      durationSec: number;
      caption: string;
      assetType: 'screenshot_hero' | 'screenshot_feature' | 'brand_card';
      motionEffect: 'zoom_in' | 'pan_down' | 'tilt_3d';
    }>;
  };
  
  audioUrl?: string;
  outputVideoUrl?: string;
  durationSeconds?: number;
  
  createdAt: FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.Timestamp;
}
```

### 4.2 Concurrency & Race-Condition Prevention (Firestore Atomic Transactions)
To eliminate race conditions (e.g. double-tapping "Generate" or rapid balance exploitation), credit deduction and job insertion execute inside an atomic transaction:

```typescript
export async function createVideoJobWithDeduction(
  userId: string, 
  jobData: CreateJobInput, 
  idempotencyKey: string
): Promise<string> {
  const userRef = db.collection('users').doc(userId);
  const existingJobQuery = await db.collection('video_jobs')
    .where('userId', '==', userId)
    .where('idempotencyKey', '==', idempotencyKey)
    .limit(1)
    .get();

  if (!existingJobQuery.empty) {
    return existingJobQuery.docs[0].id; // Return existing job if duplicate request
  }

  return await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw new Error('User not found');
    
    const userData = userDoc.data() as UserDocument;
    if (userData.creditsRemaining <= 0) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    const jobRef = db.collection('video_jobs').doc();
    
    // 1. Deduct credit
    transaction.update(userRef, {
      creditsRemaining: userData.creditsRemaining - 1,
      totalVideosCreated: (userData.totalVideosCreated || 0) + 1,
      updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
    });

    // 2. Create job in queued state
    transaction.set(jobRef, {
      id: jobRef.id,
      userId,
      idempotencyKey,
      ...jobData,
      status: 'queued',
      progress: 5,
      createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
    });

    return jobRef.id;
  });
}
```

---

## 5. Microservices Implementation Details

### 5.1 Playwright Smart Scraper (`scraper.service.ts`)
- Configured with high-DPI viewport (retina rendering).
- Automatically clears common cookie consent dialogs and popups.
- Extracts clean brand colors and crops key viewport sections.

### 5.2 Gemini 2.0 Flash Storyboard Engine (`ai.service.ts`)
- Utilizes strict **JSON Schema enforcement** (`responseMimeType: "application/json"`).
- Generates 30-second pacing (Hook: 0–4s, Problem: 4–12s, Solution/Demo: 12–24s, CTA: 24–30s).

### 5.3 Google Cloud Text-to-Speech Engine (`tts.service.ts`)
- Uses `en-US-Neural2-F` or `en-US-Neural2-D`.
- Applies speaking rate `1.05x` for short-form retention.
- Generates audio buffers uploaded directly to GCS.

### 5.4 Remotion Video Composition (`remotion/`)
- Built with modular React components:
  - `<KineticCaptions />`: Synced karaoke-style word highlighting.
  - `<DeviceFrame />`: 3D perspective tilt with spring animations.
  - `<CursorFollower />`: Smooth simulated cursor interactions.
  - `<BrandedIntroOutro />`: Animated logo and website URL watermark.

---

## 6. React Native (iOS) App Architecture & Libraries

### 6.1 Core Native Dependencies
```json
{
  "dependencies": {
    "expo": "~51.0.0",
    "expo-av": "~14.0.5",
    "expo-clipboard": "~6.0.3",
    "expo-file-system": "~17.0.1",
    "expo-haptics": "~13.0.1",
    "expo-media-library": "~16.0.4",
    "expo-sharing": "~12.0.1",
    "expo-updates": "~0.25.14",
    "firebase": "^10.12.0",
    "nativewind": "^4.0.1",
    "react-native-purchases": "^7.27.0",
    "lucide-react-native": "^0.380.0"
  }
}
```

### 6.2 Native Features & iOS System Integrations

1. **Auto-Clipboard Detection:**
   - On app foreground (`AppState` listener), queries `expo-clipboard`.
   - If a valid `http/https` URL is detected, renders a non-intrusive floating toast: *"Paste link from clipboard?"*.

2. **Native iOS Share Sheet (`expo-sharing`):**
   - Downloads the MP4 file to `FileSystem.cacheDirectory`.
   - Triggers native `Sharing.shareAsync` allowing 1-tap direct publishing to Instagram Stories, TikTok, Messages, and AirDrop.

3. **Camera Roll Export (`expo-media-library`):**
   - Complies with iOS Add-Only permission model.
   - Shows progress percentage indicator during file download.
   - Emits tactile success haptic via `expo-haptics`.

4. **Over-The-Air Updates (EAS Update):**
   - Configured in `app.json` for zero-friction bug fixes and instant template additions without waiting for App Store review cycles.

---

## 6.3 Zero-Hardcoding Architecture: `config.ts` & `feature.ts`

To enforce enterprise-grade security and modular control, **no credentials, tokens, project IDs, or backend URLs will be hardcoded anywhere in the codebase**.

### A. Centralized Configuration (`src/config/config.ts`)
All environment variables are validated at startup with strict typing:

```typescript
// src/config/config.ts
import Constants from 'expo-constants';

interface AppConfig {
  env: 'development' | 'staging' | 'production';
  api: {
    baseUrl: string;
    timeoutMs: number;
  };
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  purchases: {
    revenueCatAppleApiKey: string;
    entitlementId: string;
  };
  sentry: {
    dsn?: string;
  };
}

const extra = Constants.expoConfig?.extra ?? {};

export const Config: AppConfig = {
  env: (process.env.EXPO_PUBLIC_APP_ENV as AppConfig['env']) || 'development',
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || extra.apiBaseUrl || '',
    timeoutMs: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS) || 30000,
  },
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || extra.firebaseApiKey || '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || extra.firebaseAuthDomain || '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || extra.firebaseProjectId || '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || extra.firebaseStorageBucket || '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || extra.firebaseMessagingSenderId || '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || extra.firebaseAppId || '',
  },
  purchases: {
    revenueCatAppleApiKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || extra.revenueCatAppleKey || '',
    entitlementId: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro_access',
  },
  sentry: {
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  },
};

// Fail-fast sanity check on app launch
export function validateConfig(): void {
  const missing: string[] = [];
  if (!Config.api.baseUrl) missing.push('EXPO_PUBLIC_API_BASE_URL');
  if (!Config.firebase.projectId) missing.push('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
  
  if (missing.length > 0) {
    console.error(`[CONFIG ERROR] Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

### B. Dynamic Feature Flags (`src/config/feature.ts`)
Centralizes instant kill-switches and modular toggles:

```typescript
// src/config/feature.ts
export const Features = {
  // Monetization & Paywalls
  ENABLE_IN_APP_PURCHASES: process.env.EXPO_PUBLIC_FEATURE_IAP === 'true',
  ENABLE_FREE_TIER_WATERMARK: true,
  
  // UX Features
  ENABLE_AUTO_CLIPBOARD_DETECT: true,
  ENABLE_HAPTIC_FEEDBACK: true,
  ENABLE_VIDEO_PREVIEW_EDITOR: true, // Allow user to tweak captions/voice before saving
  ENABLE_AUDIO_PITCH_CONTROL: false,  // Experimental feature toggle
  
  // Aspect Ratios Allowed
  ALLOWED_ASPECT_RATIOS: {
    VERTICAL_9_16: true,
    SQUARE_1_1: true,
    LANDSCAPE_16_9: true,
  },
  
  // Analytics & Crash Reporting
  ENABLE_SENTRY_CRASH_REPORTING: process.env.EXPO_PUBLIC_APP_ENV === 'production',
  ENABLE_EAS_AUTO_UPDATES: true,
} as const;

export type FeatureKey = keyof typeof Features;
```

---

## 7. UX Flows & Screen Breakdown

### Screen 1: Welcome & Onboarding
- 3-step modern carousel explaining:
  1. *Paste your website link*
  2. *AI creates your 30s marketing promo*
  3. *Share to Reels, TikTok & Shorts*
- "Get Started" button saving `hasSeenOnboarding: true` in persistent storage.

### Screen 2: Dashboard (Create)
- URL Input card with clear button and paste button.
- Format selector: **9:16 (Vertical / Shorts)**, **1:1 (Square / Feed)**, **16:9 (Landscape / YouTube)**.
- Preset styles: *SaaS Dark*, *E-Commerce Viral*, *Minimal Editorial*.
- Prominent gradient CTA: *"Generate 30s Promo"*.

### Screen 3: Live Generation Tracker
- Realtime Firestore snapshot listener showing active stage:
  - `[25%]` Analyzing website & capturing screenshots...
  - `[50%]` Writing viral marketing hook & script...
  - `[75%]` Synthesizing studio neural voiceover...
  - `[90%]` Rendering 4K motion graphics & captions...
- Lottie animations and dynamic stage indicators.

### Screen 4: Video Player & Customizer
- High-performance video player with auto-loop and mute toggle.
- Quick editor:
  - Change Voice (Male / Female).
  - Edit Hook text caption.
  - Adjust background music volume.
- Action Buttons:
  - **Save to Photos** (1-tap native save).
  - **Share Video** (Native iOS Share Sheet).
  - **Create Another**.

---

## 8. Comprehensive Testing Suite & Negative Scenarios

### 8.1 Testing Architecture (`tests/`)
- **Unit Tests:**
  - Scraper URL normalization, DOM & OpenGraph metadata extraction, CSS brand color picker.
  - Gemini 2.0 Flash JSON schema adherence & fallback script generation.
  - Google Cloud TTS audio buffer generation & word-level timestamp alignment.
  - Concurrency & duplicate request prevention via `idempotencyKey`.
- **Integration Tests:**
  - Firestore atomic transactions for credit deduction and balance exhaustion.
  - GCS signed URL generation and 7-day lifecycle purge rule verification.
  - API gateway request validation and rate limiting.
- **End-to-End Pipeline Tests:**
  - Full automated lifecycle: Live URL ingestion → Playwright scrape → Gemini 2.0 storyboard → Neural2 TTS → Remotion video render → GCS upload.
- **Negative Scenarios & Edge Cases:**
  - **Login / Paywall Protected Sites:** Clean error classification (`PAYWALL_DETECTED`) with actionable recovery advice.
  - **Malformed / 404 URLs:** Instant pre-flight rejection without cloud resource wastage.
  - **Slow-loading / Heavy Websites:** Playwright 25s timeout with fallback OpenGraph extractor.
  - **Double-Tap Race Conditions:** Deduplication check returns identical active job.
  - **Zero Balance / Credit Exhaustion:** Atomic transaction rollback & Paywall sheet trigger.
  - **Client App Backgrounding / Disconnect:** Asynchronous server pipeline continues; real-time Firestore listener auto-syncs on reconnect.

### 8.2 Pre-Testing Input & Target Verification Matrix

| Input Category & Test Value | Target Test Suite | Purpose & Expected Verification |
| :--- | :--- | :--- |
| **Live SaaS URL**<br>`https://supabase.com` | E2E Pipeline (9:16 Vertical) | Tests full flow: Retina screenshot, Gemini 2.0 4-scene script, Neural2 TTS, and 4K Remotion video rendering. |
| **Live E-Commerce URL**<br>`https://allbirds.com` | E2E Multi-Aspect (1:1 & 16:9) | Validates product image extraction, punchy e-commerce script style, and adaptive aspect ratio rendering. |
| **Paywall / Login-Gated URL**<br>`https://nytimes.com` | Negative Scenario: Paywall Interception | Verifies scraper catches authentication wall, flags `PAYWALL_DETECTED`, and prompts user with actionable fallback without hanging. |
| **Broken / Non-Existent URL**<br>`https://thisdomaindoesnotexist12345.org` | Negative Scenario: 404 & Malformed Format | Tests pre-flight validation rejection preventing unnecessary cloud compute or credit deduction. |
| **Heavy / Slow Loading URL**<br>Simulated slow network delay (30s+) | Edge Case: Timeout & Fallback Scraper | Validates Playwright 25s timeout threshold and seamless fallback to OpenGraph & DOM meta tag extraction. |
| **Simulated Rapid Double-Tap Payload**<br>5 simultaneous POSTs with identical `idempotencyKey` | Concurrency & Idempotency Test | Verifies atomic transaction locking: exactly 1 credit is deducted and 1 video job is processed. |
| **User Account with 0 Credits**<br>`creditsRemaining: 0` | Negative Scenario: Credit Exhaustion | Verifies atomic transaction aborts job creation and mobile client displays Pro Paywall Sheet. |
| **Simulated Client Disconnect**<br>Client disconnects during active render | Resilience & Firestore Sync Test | Cloud Run finishes rendering; client receives real-time snapshot update immediately upon reconnect. |

---

## 9. Apple App Store Guidelines Compliance Checklist

1. **Privacy & Permissions (Guideline 5.1.1):**
   - Info.plist includes clean, user-friendly usage description:
     `NSPhotoLibraryAddUsageDescription`: *"LinkReel requires access to your photos to save your generated marketing videos."*
2. **In-App Purchases (Guideline 3.1.1):**
   - Configured via RevenueCat with native StoreKit 2 integration.
   - Visible "Restore Purchases" button in Settings and Paywall screens.
   - Clear display of Terms of Use (EULA) and Privacy Policy.
3. **Resilient Error Communication (Guideline 2.1):**
   - Every error state provides clear, actionable instructions (e.g., *"This website is behind a login wall. Please enter a public page."* with a *"Try Another URL"* button).
   - Zero infinite loaders or silent failures.

---

## 10. Execution Roadmap & Verification Milestones

- **Phase 1 (Cloud Infrastructure):** Provision brand new dedicated GCP Project, Firestore Native DB (`nam5`), and GCS buckets. Document direct links in `IMPLEMENTATION_TRACKING.md`.
- **Phase 2 (Backend Pipeline):** Build Cloud Run microservices (Playwright Scraper, Gemini 2.0 Storyboarder, Google Cloud TTS, and Remotion 4K Renderer).
- **Phase 3 (Mobile Client):** Build Expo React Native iOS application with OLED dark design system, native clipboard detector, video player, camera roll exporter, and share sheet.
- **Phase 4 (Comprehensive Test Suite):** Execute unit, integration, negative edge case, and full end-to-end pipeline test suite.
- **Phase 5 (End-to-End Verification):** Verify live video render, UI flows, and final delivery report with all direct resource links.
