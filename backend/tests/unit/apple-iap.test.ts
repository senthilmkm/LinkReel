import 'reflect-metadata';
import * as x509 from '@peculiar/x509';
import { webcrypto, createPrivateKey, sign } from 'crypto';
import http from 'http';
import { AddressInfo } from 'net';
import { decodeAppleJws, assertApplePurchase, verifyAppleSignedTransaction, AppleIapError } from '../../src/services/apple-iap';
import { app } from '../../src/api/server';
import { firestore, USERS_COLLECTION, PURCHASES_COLLECTION, getOrCreateUser } from '../../src/services/firestore.service';

x509.cryptoProvider.set(webcrypto as unknown as Crypto);

const PRODUCT = 'com.linkreel.credits.10';

async function makeTestChain() {
  const alg = { name: 'ECDSA', namedCurve: 'P-256' } as const;
  const hash = { name: 'ECDSA', hash: 'SHA-256' } as const;
  const rootKeys = await webcrypto.subtle.generateKey(alg, true, ['sign', 'verify']);
  const leafKeys = await webcrypto.subtle.generateKey(alg, true, ['sign', 'verify']);
  const now = new Date();
  const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const root = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: '01',
    name: 'CN=LinkReel Test Root',
    notBefore: now,
    notAfter: later,
    signingAlgorithm: hash,
    keys: { publicKey: rootKeys.publicKey, privateKey: rootKeys.privateKey },
  });

  const leaf = await x509.X509CertificateGenerator.create({
    serialNumber: '02',
    subject: 'CN=LinkReel Test Leaf',
    issuer: root.subject,
    notBefore: now,
    notAfter: later,
    signingAlgorithm: hash,
    publicKey: leafKeys.publicKey,
    signingKey: rootKeys.privateKey,
  });

  const pkcs8 = await webcrypto.subtle.exportKey('pkcs8', leafKeys.privateKey);
  const privateKey = createPrivateKey({ key: Buffer.from(pkcs8), format: 'der', type: 'pkcs8' });
  const rootPem = derToPem(Buffer.from(root.rawData), 'CERTIFICATE');
  const x5c = [
    Buffer.from(leaf.rawData).toString('base64'),
    Buffer.from(root.rawData).toString('base64'),
  ];
  return { privateKey, rootPem, x5c };
}

function derToPem(der: Buffer, type: string): string {
  const b64 = der.toString('base64');
  return `-----BEGIN ${type}-----\n${b64.match(/.{1,64}/g)?.join('\n')}\n-----END ${type}-----\n`;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: `1000000${Date.now()}`,
    originalTransactionId: `1000000${Date.now()}`,
    bundleId: 'com.linkreel.app',
    productId: PRODUCT,
    type: 'Consumable',
    environment: 'Sandbox',
    purchaseDate: Date.now(),
    ...overrides,
  };
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signTx(chain: Awaited<ReturnType<typeof makeTestChain>>, body: Record<string, unknown>) {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'ES256', x5c: chain.x5c })));
  const payload = b64url(Buffer.from(JSON.stringify(body)));
  const data = Buffer.from(`${header}.${payload}`);
  const signature = sign('SHA256', data, { key: chain.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64url(signature)}`;
}

describe('Apple signed transaction verification', () => {
  let chain: Awaited<ReturnType<typeof makeTestChain>>;

  beforeAll(async () => {
    chain = await makeTestChain();
    process.env.APPLE_IAP_TEST_ROOT = chain.rootPem;
  });

  afterAll(() => {
    delete process.env.APPLE_IAP_TEST_ROOT;
  });

  it('accepts a valid ES256 JWS chained to the test root', async () => {
    const body = payload();
    const jws = await signTx(chain, body);
    const verified = verifyAppleSignedTransaction(jws, PRODUCT);
    expect(verified.transactionId).toBe(body.transactionId);
    expect(verified.productId).toBe(PRODUCT);
  });

  it('rejects a JWS with a broken signature', async () => {
    const jws = await signTx(chain, payload());
    const parts = jws.split('.');
    const flipped = parts[2].startsWith('A') ? `B${parts[2].slice(1)}` : `A${parts[2].slice(1)}`;
    expect(() => verifyAppleSignedTransaction(`${parts[0]}.${parts[1]}.${flipped}`, PRODUCT)).toThrow(
      AppleIapError
    );
  });

  it('rejects the wrong bundle id', () => {
    expect(() =>
      assertApplePurchase(payload({ bundleId: 'com.other.app' }) as any, PRODUCT)
    ).toThrow(/different app/);
  });

  it('rejects a mismatched product', () => {
    expect(() =>
      assertApplePurchase(payload({ productId: 'com.linkreel.credits.25' }) as any, PRODUCT)
    ).toThrow(/does not match/);
  });

  it('rejects refunded transactions', () => {
    expect(() =>
      assertApplePurchase(payload({ revocationDate: Date.now() }) as any, PRODUCT)
    ).toThrow(/refunded/);
  });

  it('rejects garbage input', () => {
    expect(() => decodeAppleJws('not-a-jws')).toThrow(AppleIapError);
  });
});

describe('POST /api/v1/purchases/confirm (Apple JWS → credits)', () => {
  let chain: Awaited<ReturnType<typeof makeTestChain>>;
  let server: http.Server;
  let base: string;
  const userId = `iap_e2e_${Date.now()}`;

  beforeAll(async () => {
    chain = await makeTestChain();
    process.env.APPLE_IAP_TEST_ROOT = chain.rootPem;
    await getOrCreateUser(userId, `${userId}@linkreel.user`);
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      await firestore.collection(USERS_COLLECTION).doc(userId).delete();
    } catch {}
    delete process.env.APPLE_IAP_TEST_ROOT;
  });

  it('grants 10 credits once, then treats the same Apple transaction as a duplicate', async () => {
    const body = payload({ transactionId: `e2e${Date.now()}1234` });
    const jws = await signTx(chain, body);

    const first = await fetch(`${base}/api/v1/purchases/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, productId: PRODUCT, signedTransaction: jws }),
    });
    const firstJson = await first.json();
    expect(first.status).toBe(200);
    expect(firstJson.creditsAdded).toBe(10);
    expect(firstJson.creditsRemaining).toBe(13);
    expect(firstJson.duplicate).toBe(false);

    const second = await fetch(`${base}/api/v1/purchases/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, productId: PRODUCT, signedTransaction: jws }),
    });
    const secondJson = await second.json();
    expect(second.status).toBe(200);
    expect(secondJson.duplicate).toBe(true);
    expect(secondJson.creditsAdded).toBe(0);
    expect(secondJson.creditsRemaining).toBe(13);

    await firestore.collection(PURCHASES_COLLECTION).doc(String(body.transactionId)).delete().catch(() => undefined);
  });

  it('rejects a raw transaction id without a signed Apple JWS', async () => {
    const res = await fetch(`${base}/api/v1/purchases/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        productId: PRODUCT,
        signedTransaction: '1000000123456789',
      }),
    });
    expect(res.status).toBe(400);
  });
});
