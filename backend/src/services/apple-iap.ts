import { X509Certificate, verify } from 'crypto';
import fs from 'fs';
import path from 'path';
import { creditsForProduct } from '../config/billing';

const BUNDLE_ID = 'com.linkreel.app';
const APPLE_ROOT_PEM = fs.readFileSync(
  path.join(__dirname, '../certs/apple-root-ca-g3.pem'),
  'utf8'
);

export type AppleIapEnvironment = 'Sandbox' | 'Production' | 'Xcode';

export interface AppleSignedTransaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  type: string;
  environment: AppleIapEnvironment;
  purchaseDate: number;
  revocationDate?: number;
  appAccountToken?: string;
}

export class AppleIapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'APPLE_IAP_INVALID';
  }
}

function b64urlToBuf(part: string): Buffer {
  const pad = '='.repeat((4 - (part.length % 4)) % 4);
  return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function jsonPart(part: string): any {
  return JSON.parse(b64urlToBuf(part).toString('utf8'));
}

function pinnedRoot(): X509Certificate {
  const override = process.env.APPLE_IAP_TEST_ROOT;
  return new X509Certificate(override && process.env.NODE_ENV === 'test' ? override : APPLE_ROOT_PEM);
}

function certFromX5c(entry: string): X509Certificate {
  return new X509Certificate(Buffer.from(entry.replace(/\s/g, ''), 'base64'));
}

function assertIssuedBy(child: X509Certificate, issuer: X509Certificate) {
  if (!child.checkIssued(issuer) || !child.verify(issuer.publicKey)) {
    throw new AppleIapError('Apple certificate chain is invalid.');
  }
}

function verifyX5cChain(x5c: string[]): X509Certificate {
  if (!Array.isArray(x5c) || x5c.length < 1 || x5c.length > 4) {
    throw new AppleIapError('Apple certificate chain is missing.');
  }
  const certs = x5c.map(certFromX5c);
  const root = pinnedRoot();
  for (let i = 0; i < certs.length - 1; i += 1) {
    assertIssuedBy(certs[i], certs[i + 1]);
  }
  const last = certs[certs.length - 1];
  if (last.fingerprint256 === root.fingerprint256) {
    assertIssuedBy(last, root);
  } else {
    assertIssuedBy(last, root);
  }
  const leaf = certs[0];
  const now = new Date();
  if (now < new Date(leaf.validFrom) || now > new Date(leaf.validTo)) {
    throw new AppleIapError('Apple signing certificate is expired.');
  }
  return leaf;
}

function verifyEs256(jws: string, leaf: X509Certificate): void {
  const [h, p, s] = jws.split('.');
  const signature = b64urlToBuf(s);
  const data = Buffer.from(`${h}.${p}`);
  let ok = false;
  try {
    ok = verify('SHA256', data, { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' }, signature);
  } catch {
    ok = false;
  }
  if (!ok) throw new AppleIapError('Apple purchase signature is invalid.');
}

export function decodeAppleJws(jws: string): { header: any; payload: AppleSignedTransaction } {
  const parts = String(jws || '').split('.');
  if (parts.length !== 3 || parts.some((p) => p.length < 8)) {
    throw new AppleIapError('That purchase is not a signed Apple transaction.');
  }
  let header: any;
  let payload: any;
  try {
    header = jsonPart(parts[0]);
    payload = jsonPart(parts[1]);
  } catch {
    throw new AppleIapError('That purchase is not a signed Apple transaction.');
  }
  return { header, payload };
}

export function assertApplePurchase(payload: AppleSignedTransaction, productId: string): void {
  if (payload.bundleId !== BUNDLE_ID) {
    throw new AppleIapError('That purchase is for a different app.');
  }
  if (payload.productId !== productId) {
    throw new AppleIapError('That purchase does not match the pack you tapped.');
  }
  if (!creditsForProduct(payload.productId)) {
    throw new AppleIapError('UNKNOWN_PRODUCT');
  }
  if (payload.type && payload.type !== 'Consumable') {
    throw new AppleIapError('Only one-time credit packs can be redeemed.');
  }
  if (payload.revocationDate) {
    throw new AppleIapError('That purchase was refunded or revoked.');
  }
  const tx = String(payload.transactionId || '').trim();
  if (tx.length < 8 || tx.length > 80) {
    throw new AppleIapError('INVALID_TRANSACTION');
  }
  const env = payload.environment;
  if (env && env !== 'Sandbox' && env !== 'Production' && env !== 'Xcode') {
    throw new AppleIapError('Unknown Apple purchase environment.');
  }
}

export function verifyAppleSignedTransaction(jws: string, productId: string): AppleSignedTransaction {
  const { header, payload } = decodeAppleJws(jws);
  if (header.alg !== 'ES256') {
    throw new AppleIapError('Unsupported Apple signature algorithm.');
  }
  const leaf = verifyX5cChain(header.x5c);
  verifyEs256(jws, leaf);
  assertApplePurchase(payload, productId);
  return payload;
}
