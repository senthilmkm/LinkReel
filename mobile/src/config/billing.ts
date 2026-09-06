/** Must match App Store Connect product IDs before public sale. */
export const FREE_REEL_CREDITS = 3;

export const CREDIT_PACKS = [
  {
    productId: 'com.linkreel.credits.10',
    credits: 10,
    displayPrice: '$4.99',
    title: '10 reels',
    subtitle: 'One-time pack · $0.50 per reel',
  },
  {
    productId: 'com.linkreel.credits.25',
    credits: 25,
    displayPrice: '$9.99',
    title: '25 reels',
    subtitle: 'One-time pack · $0.40 per reel',
  },
] as const;

export const LEGAL_URLS = {
  terms: 'https://senthilmkm.github.io/LinkReel/terms.html',
  privacy: 'https://senthilmkm.github.io/LinkReel/privacy.html',
  appleEula: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
  github: 'https://github.com/senthilmkm/LinkReel',
};
