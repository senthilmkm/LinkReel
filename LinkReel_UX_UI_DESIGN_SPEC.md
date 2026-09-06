# LinkReel — UX/UI Design Specification & Visual System

---

## 1. Visual Identity & Design Language

LinkReel adopts a **Modern Dark Mode Aesthetic** engineered specifically for iOS (iOS 17+ HIG compliant). It blends deep OLED obsidian backgrounds with vibrant electric gradients, frosted glassmorphism (`UIBlurEffect`), and responsive spring micro-animations.

### 1.1 Color Palette & Design Tokens

```
┌────────────────────────────────────────────────────────────────────────┐
│ PRIMARY & SURFACE COLORS                                              │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ Token             │ Hex Code          │ Usage                          │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ `bg-obsidian`     │ `#07090E`         │ Base Screen Background (OLED)  │
│ `surface-card`    │ `#121622`         │ Cards & Elevated Containers    │
│ `surface-glass`   │ `rgba(255,255,255,0.06)` │ Frosted Glass Overlays  │
│ `surface-border`  │ `rgba(255,255,255,0.12)` │ High-Contrast Borders   │
├───────────────────┴───────────────────┴────────────────────────────────┤
│ ACCENT GRADIENTS & BRAND SIGNATURES                                    │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ `accent-indigo`   │ `#6366F1`         │ Primary Action / Brand Core    │
│ `accent-cyan`     │ `#06B6D4`         │ Tech Highlights & Scraper Glow │
│ `accent-purple`   │ `#A855F7`         │ AI Storyboard & Video Engine   │
│ `accent-amber`    │ `#F59E0B`         │ Pro / Credits / High-Energy    │
│ `brand-gradient`  │ `linear-gradient(135deg, #6366F1, #A855F7, #06B6D4)`│
├───────────────────┴───────────────────┴────────────────────────────────┤
│ SEMANTIC STATUS COLORS                                                 │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ `status-success`  │ `#10B981`         │ Render Complete / Saved        │
│ `status-error`    │ `#EF4444`         │ Scrape / Generation Errors     │
│ `status-warning`  │ `#F59E0B`         │ Low Credits / Paywall Alert    │
│ `text-primary`    │ `#F9FAFB`         │ Main Headlines & Body Text     │
│ `text-secondary`  │ `#94A3B8`         │ Subtitles & Secondary Metadata │
│ `text-muted`      │ `#64748B`         │ Inactive states & Placeholders │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

### 1.2 Typography System (SF Pro / Inter)
- **Display 1 (Hero Hook):** 32pt / Bold / Tight Tracking (`-0.5px`)
- **Title 1 (Screen Headers):** 24pt / SemiBold
- **Title 2 (Card Titles):** 18pt / SemiBold
- **Body Regular:** 15pt / Regular / 1.4 Line Height
- **Body Medium:** 15pt / Medium
- **Caption / Badge:** 12pt / SemiBold / Uppercase Spacing (`+0.8px`)

---

## 2. Navigation Architecture & Screen Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    ROOT STACK NAVIGATION                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
 ┌──────────────────────┐              ┌──────────────────────┐
 │   Onboarding Flow    │ (If 1st Run) │   Main Tab Engine    │
 │ (3-Step Value Tour)  │              │                      │
 └──────────────────────┘              └──────────┬───────────┘
                                                  │
          ┌────────────────────────┬──────────────┴───────────────┐
          ▼                        ▼                              ▼
 ┌─────────────────┐      ┌─────────────────┐            ┌─────────────────┐
 │ Create / Studio │      │ Project Library │            │ Account / Pro   │
 │ (Default Tab)   │      │ (Saved Videos)  │            │ & Settings Tab  │
 └────────┬────────┘      └─────────────────┘            └─────────────────┘
          │
          ├──▶ [Modal] Live Generation Progress Tracker
          │
          └──▶ [Modal] Fullscreen Video Player & Studio Editor
```

---

## 3. Screen-by-Screen Wireframes & Component Breakdown

### 📱 Screen 1: Onboarding Carousel
*Goal: Educate the user in <5 seconds and prime iOS permissions.*

- **Slide 1:** *"Turn any Website into Viral Reels"* (Visual: URL bar transforming into 3D TikTok/Reel frame).
- **Slide 2:** *"AI Scrapes, Scripts & Narrates"* (Visual: Gemini neural nodes + auto-captions waveform).
- **Slide 3:** *"1-Tap Export to TikTok & Instagram"* (Visual: Native iOS Share Sheet).
- **Bottom Action:**
  - Gradient Button: *"Get Started"* (`accent-indigo` to `accent-purple`).
  - Secondary Text: *"Already have an account? Sign In"*.

---

### 📱 Screen 2: Create & Dashboard (Core Experience)
*Goal: Frictionless input with intelligent auto-paste and instant configuration.*

```
┌──────────────────────────────────────────────────┐
│  LinkReel ✦                           [ ⚡ 5 ]   │  <-- Brand Logo + Credits Pill
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ 📋 Link Detected in Clipboard              │  │  <-- Floating Auto-Paste Toast
│  │ "https://superbase.io"   [ Tap to Paste ]  │  │      (Triggered on App Foreground)
│  └────────────────────────────────────────────┘  │
│                                                  │
│  WEBSITE URL                                     │
│  ┌────────────────────────────────────────────┐  │
│  │ 🌐 | https://example.com/product     [Paste]│  │  <-- Clearable URL Input Card
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ASPECT RATIO                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
│  │ 📱 9:16      │ │ ⬛ 1:1       │ │ 💻 16:9  │  │  <-- Animated Haptic Segmented Pills
│  │  Reels/TikTok│ │  Instagram   │ │  YouTube │  │
│  │  [Selected]  │ │              │ │          │  │
│  └──────────────┘ └──────────────┘ └──────────┘  │
│                                                  │
│  VIDEO STYLE & VOICE                             │
│  ┌────────────────────────┐ ┌──────────────────┐ │
│  │ 🚀 SaaS Dark Mode      │ │ ⚡ Viral Punchy  │ │  <-- Visual Style Selector Cards
│  │ Voice: Alex (Neural-D) │ │ Voice: Nora (F)  │ │
│  └────────────────────────┘ └──────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ ✨  GENERATE 30s PROMO VIDEO               │  │  <-- Vibrant Pulse Gradient CTA
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

### 📱 Screen 3: Live Generation Progress Tracker (Modal)
*Goal: Keep user engaged during the 45-second render with rich visual feedback.*

```
┌──────────────────────────────────────────────────┐
│                      [ X ]                       │  <-- Minimize to Background
│                                                  │
│                 ╭─────────────╮                  │
│                │   ✦ 65% ✦   │                  │  <-- Glowing Radial Progress Ring
│                 ╰─────────────╯                  │      with animated particles
│                                                  │
│             Creating Your Promo Video            │
│         "Transforming stripe.com into 4K Reel"   │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  ✓ [100%] Headless Browser Scrape Done    │  │  <-- Completed Stage (Green Check)
│  │  ✓ [100%] Gemini 2.0 Viral Script Formed  │  │
│  │  ● [ 65%] Google Neural2 Studio Voiceover │  │  <-- Active Stage (Pulsing Cyan)
│  │  ○ [  0%] Remotion Motion Graphics Render │  │  <-- Pending Stage (Muted)
│  └────────────────────────────────────────────┘  │
│                                                  │
│  💡 "Did you know? 9:16 videos get 2.5x more     │  <-- Pro Marketing Tips Carousel
│      engagement on Instagram Reels than 16:9!"   │
└──────────────────────────────────────────────────┘
```

---

### 📱 Screen 4: Video Player & Studio Editor
*Goal: Immediate satisfaction, instant social sharing, and quick customization.*

```
┌──────────────────────────────────────────────────┐
│  < Back                                 [ Edit ] │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │             [ 9:16 VIDEO PLAYER ]          │  │  <-- Full-bleed auto-looping
│  │                                            │  │      React Native Video Player
│  │            "Turn hours of work             │  │      with synced kinetic captions
│  │              into seconds!"                │  │
│  │                                            │  │
│  │              [ 🔊 / 🔇 ]                   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  QUICK CUSTOMIZATIONS                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
│  │ 🗣 Switch    │ │ ✍ Edit Hook  │ │ 🎵 Music │  │  <-- Instant quick-tweak tools
│  │   Voice      │ │   Caption    │ │   Track  │  │
│  └──────────────┘ └──────────────┘ └──────────┘  │
│                                                  │
│  EXPORT & SHARE                                  │
│  ┌───────────────────────┐ ┌──────────────────┐  │
│  │ 📥 Save to Photos     │ │ 🚀 Share Video   │  │  <-- Primary Action Buttons
│  │    (Native Camera Roll│ │    (iOS Sheet)   │  │      (Haptic trigger on completion)
│  └───────────────────────┘ └──────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## 4. Micro-Interactions, Spring Physics & Haptic Feedback

1. **Button Tap Physics:** `transform: scale(0.96)` on press with spring restitution (`damping: 15, stiffness: 200`).
2. **Tactile Haptic Feedback (`expo-haptics`):**
   - *Selection Changed:* `ImpactFeedbackStyle.Light`
   - *Generation Started:* `ImpactFeedbackStyle.Medium`
   - *Video Finished / Saved to Photos:* `NotificationFeedbackType.Success`
   - *Error State:* `NotificationFeedbackType.Error`
3. **Skeleton & Shimmer States:** Linear gradient shimmer during data load to eliminate layout shifts.

---

## 5. Paywall & In-App Purchase Modal (Apple Compliance)

- **Header:** *"Unlock Unlimited 4K Video Exports"*.
- **Feature Matrix:**
  - ✨ Remove Watermark.
  - ⚡ 4K 60fps Remotion HD Render.
  - 🗣 All 12 Neural2 Studio AI Voices.
  - ♾️ Unlimited Monthly Generations.
- **Pricing Cards:** Monthly ($19.99/mo) vs Annual ($119.99/yr — *Save 50%*).
- **Apple StoreKit Footer:** "Restore Purchases" | "Terms of Service (EULA)" | "Privacy Policy".
