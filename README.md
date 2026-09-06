# LinkReel

Paste an App Store listing. Get a short 9:16 promo reel.

Planning the 4 scenes is free. Generating a finished reel uses 1 credit.

## Credits

Controlled by [`docs/pricing.json`](https://senthilmkm.github.io/LinkReel/pricing.json) (edit that file, push, the app and API pick it up within a couple of minutes):

- New users: **3 free reels** (not unlimited)
- Packs (one-time In-App Purchase, not a subscription):
  - `$4.99` → 10 reels (`com.linkreel.credits.10`)
  - `$9.99` → 25 reels (`com.linkreel.credits.25`)
- Subscriptions are in the file but **off** (`flags.subscriptionsEnabled` and each plan `enabled`)
- Home banner, paywall copy, restore text, and plan details all come from this file
- Restore Purchases finishes an interrupted buy. Used credits cannot be restored.

## Legal

- [Terms of Use](https://senthilmkm.github.io/LinkReel/terms.html)
- [Privacy Policy](https://senthilmkm.github.io/LinkReel/privacy.html)
- [Apple Licensed Application EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/)
