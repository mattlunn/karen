import { X509Certificate, createVerify } from 'crypto';

/**
 * A custom skill hosted as a web service is a public, unauthenticated endpoint — Alexa sends no
 * bearer token and no cookies, so the usual `middleware/auth` cannot be used. Instead Amazon
 * requires the request itself to be verified:
 *
 *  1. The signing certificate is fetched from the URL in the SignatureCertChainUrl header. That URL
 *     is attacker-supplied, so it must be constrained to Amazon's bucket before we fetch it.
 *  2. The certificate must be valid for echo-api.amazon.com, in date, and chain to its issuer.
 *  3. The Signature-256 header must be a valid RSA-SHA256 signature of the *raw* request body.
 *  4. The request timestamp must be recent, so a captured request cannot be replayed.
 *  5. The applicationId must be ours, so another skill cannot drive our endpoint.
 *
 * https://developer.amazon.com/docs/custom-skills/host-a-custom-skill-as-a-web-service.html
 */

const CERT_CHAIN_HOSTNAME = 's3.amazonaws.com';
const CERT_CHAIN_PATH_PREFIX = '/echo.api/';
const CERT_SAN_HOSTNAME = 'echo-api.amazon.com';
const MAX_TIMESTAMP_SKEW_MS = 150 * 1000;
const CERT_CACHE_LIMIT = 8;

export class AlexaVerificationError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'AlexaVerificationError';
  }
}

export function parseCertChainUrl(rawUrl: string | undefined): URL {
  if (!rawUrl) {
    throw new AlexaVerificationError('Request has no SignatureCertChainUrl header');
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new AlexaVerificationError(`SignatureCertChainUrl is not a URL: "${rawUrl}"`);
  }

  // new URL() has already resolved any ".." segments, so a prefix check is enough to keep us within
  // the bucket. The path comparison is case-sensitive; the hostname deliberately is not.
  if (url.protocol !== 'https:') {
    throw new AlexaVerificationError(`SignatureCertChainUrl is not https: "${rawUrl}"`);
  }

  if (url.hostname.toLowerCase() !== CERT_CHAIN_HOSTNAME) {
    throw new AlexaVerificationError(`SignatureCertChainUrl is not hosted on ${CERT_CHAIN_HOSTNAME}: "${rawUrl}"`);
  }

  if (url.port !== '' && url.port !== '443') {
    throw new AlexaVerificationError(`SignatureCertChainUrl is not on port 443: "${rawUrl}"`);
  }

  if (!url.pathname.startsWith(CERT_CHAIN_PATH_PREFIX)) {
    throw new AlexaVerificationError(`SignatureCertChainUrl is outside ${CERT_CHAIN_PATH_PREFIX}: "${rawUrl}"`);
  }

  return url;
}

export function parseCertificateChain(pem: string): X509Certificate[] {
  const certificates = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);

  if (certificates === null) {
    throw new AlexaVerificationError('Signing certificate chain contained no certificates');
  }

  try {
    return certificates.map((certificate) => new X509Certificate(certificate));
  } catch (e) {
    throw new AlexaVerificationError(`Could not parse the signing certificate chain: ${(e as Error).message}`);
  }
}

export function assertChainIsValid(chain: X509Certificate[], now: Date): void {
  const [leaf] = chain;

  if (!leaf.checkHost(CERT_SAN_HOSTNAME)) {
    throw new AlexaVerificationError(`Signing certificate is not valid for ${CERT_SAN_HOSTNAME}`);
  }

  for (const certificate of chain) {
    const { validFromDate, validToDate } = certificate;

    if (validFromDate === undefined || validToDate === undefined) {
      throw new AlexaVerificationError(`Certificate "${certificate.subject}" has no validity window`);
    }

    if (now < validFromDate || now > validToDate) {
      throw new AlexaVerificationError(`Certificate "${certificate.subject}" is outside its validity window`);
    }
  }

  // Provenance comes from TLS — we fetched this over HTTPS from Amazon's own bucket, verified
  // against the system trust store. Walking the chain here additionally proves the leaf that signed
  // the request really is the one the rest of the chain vouches for.
  for (let i = 0; i < chain.length - 1; i++) {
    if (!chain[i].verify(chain[i + 1].publicKey)) {
      throw new AlexaVerificationError(`Certificate "${chain[i].subject}" was not issued by "${chain[i + 1].subject}"`);
    }
  }
}

export function assertSignatureIsValid(leaf: X509Certificate, signature: string | undefined, rawBody: Buffer | undefined): void {
  if (!signature) {
    throw new AlexaVerificationError('Request has no Signature-256 header');
  }

  if (rawBody === undefined) {
    throw new AlexaVerificationError('Request body was not captured, so its signature cannot be checked');
  }

  const verifier = createVerify('RSA-SHA256');

  verifier.update(rawBody);

  let verified: boolean;

  try {
    verified = verifier.verify(leaf.publicKey, signature, 'base64');
  } catch (e) {
    throw new AlexaVerificationError(`Could not check the request signature: ${(e as Error).message}`);
  }

  if (!verified) {
    throw new AlexaVerificationError('Request body does not match its Signature-256 header');
  }
}

export function assertTimestampIsFresh(timestamp: string | undefined, now: Date): void {
  if (!timestamp) {
    throw new AlexaVerificationError('Request has no timestamp');
  }

  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    throw new AlexaVerificationError(`Request timestamp is not a date: "${timestamp}"`);
  }

  if (Math.abs(now.getTime() - parsed) > MAX_TIMESTAMP_SKEW_MS) {
    throw new AlexaVerificationError(`Request timestamp "${timestamp}" is more than ${MAX_TIMESTAMP_SKEW_MS / 1000}s away from now`);
  }
}

export function assertApplicationIdMatches(applicationId: string | undefined, expected: string): void {
  // Neither value goes in the message. Our own applicationId is not a secret, but it is not rotatable
  // either, so there is no reason to copy it into the logs of whatever ships them off the box; and
  // echoing an attacker's guess back alongside "wrong" is a slow way to leak which guesses were close.
  if (applicationId !== expected) {
    throw new AlexaVerificationError('Request is for another skill');
  }
}

const chainCache = new Map<string, X509Certificate[]>();

export async function fetchCertificateChain(url: URL): Promise<X509Certificate[]> {
  const key = url.toString();
  const cached = chainCache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const response = await fetch(key);

  if (!response.ok) {
    throw new AlexaVerificationError(`Got a ${response.status} fetching the signing certificate from ${key}`);
  }

  const chain = parseCertificateChain(await response.text());

  // Amazon reuses one certificate for a long time, so this stays at one entry in practice. Expiry is
  // still checked per-request against the cached chain, so caching cannot keep a stale cert alive.
  if (chainCache.size >= CERT_CACHE_LIMIT) {
    chainCache.clear();
  }

  chainCache.set(key, chain);

  return chain;
}

export interface AlexaRequestToVerify {
  certChainUrl: string | undefined;
  signature: string | undefined;
  rawBody: Buffer | undefined;
  applicationId: string | undefined;
  timestamp: string | undefined;
  expectedApplicationId: string;
}

export async function verifyAlexaSkillRequest({
  certChainUrl,
  signature,
  rawBody,
  applicationId,
  timestamp,
  expectedApplicationId
}: AlexaRequestToVerify, now = new Date()): Promise<void> {
  // Cheap checks first, so a forged request cannot make us fetch a certificate or do RSA work.
  assertApplicationIdMatches(applicationId, expectedApplicationId);
  assertTimestampIsFresh(timestamp, now);

  const chain = await fetchCertificateChain(parseCertChainUrl(certChainUrl));

  assertChainIsValid(chain, now);
  assertSignatureIsValid(chain[0], signature, rawBody);
}
