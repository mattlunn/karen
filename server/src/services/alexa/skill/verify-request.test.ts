import { createSign } from 'crypto';
import {
  AlexaVerificationError,
  parseCertChainUrl,
  parseCertificateChain,
  assertChainIsValid,
  assertSignatureIsValid,
  assertTimestampIsFresh,
  assertApplicationIdMatches
} from './verify-request';

// A throwaway CA and leaf, generated for these tests alone. They run to 2126 and are only ever
// checked against the fixed NOW below, so they cannot expire out from under the suite.
const LEAF_PEM = `-----BEGIN CERTIFICATE-----
MIIDKDCCAhCgAwIBAgIUBz94Dd46f55FNreGVS35s+BQA4owDQYJKoZIhvcNAQEL
BQAwGDEWMBQGA1UEAwwNVGVzdCBBbGV4YSBDQTAgFw0yNjA4MjYyMDA4NDNaGA8y
MTI2MDgwMjIwMDg0M1owHjEcMBoGA1UEAwwTZWNoby1hcGkuYW1hem9uLmNvbTCC
ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAL4t4RaL6pUl86KsZXl5fCyW
mzMuTEOr95qjLstvqMBdYSpRT+bJ11laC0Xq8Drtnn0ItNmKK9BMk6LUlPw+/OU1
DMHGuQqbMI+QsDVCZu4RJI4qwArTIIUHWNrmG+m7Ad+kk6YmRZIelqLqoiYGOteg
9PU48PeJL8en5LkmdlfedTIakTvxQ1ufRwYUqrlZE7Ujj48SL1l+8RF0KFZRaC7c
D4p7r7RjyfVUQtFYAEQC8xANJtfnVe5c1zk8+NgXkR3a3btgL9IuJ9A5h8gh7Srm
xk7TTfYivPfHU9V/a10wonkoALdBlnN8mZY8NkVId6ih6gdHJuJ3DAJxzd02grMC
AwEAAaNiMGAwHgYDVR0RBBcwFYITZWNoby1hcGkuYW1hem9uLmNvbTAdBgNVHQ4E
FgQUoB0WasZqwq2Y2wChIuSZRgtSzmYwHwYDVR0jBBgwFoAUL6rCUhVzkPPtXw8u
7OTgNVGbop8wDQYJKoZIhvcNAQELBQADggEBAMCo6RNTvld116Qc2XuyciQsgRaZ
euiufRcfOxEYPfVLQTXkx3KxadfD5DQ2znH0JMcLOGzy3cEwDJIKfrshEdzafOLw
cjuPvccCY5c6hv+07CVNJc0LPOZPKm6SwcX/eNqu7PRt6LQuD/AE2e8CKUDOcKd5
PbWiQcCExJj/qnTDUvn0rIIqx24SkqJWpsqgJlSJUnRtwrDxnywvZ8X0wp7dTGN5
U3/EBABlUQ73F3PmXddE+tTL/38F/GmGxQBofLB5SD+9wZNK92P3BIGasgC9fagW
5KPSNI8KjiKQU0kWykbs5h3HDoCBQXjEQ4lL3BAJro8v4uO16HXAsK8cEjM=
-----END CERTIFICATE-----`;

const CA_PEM = `-----BEGIN CERTIFICATE-----
MIIDEzCCAfugAwIBAgIURauIJEYLOxws0mjUoCw0LWlcN40wDQYJKoZIhvcNAQEL
BQAwGDEWMBQGA1UEAwwNVGVzdCBBbGV4YSBDQTAgFw0yNjA4MjYyMDA4NDNaGA8y
MTI2MDgwMjIwMDg0M1owGDEWMBQGA1UEAwwNVGVzdCBBbGV4YSBDQTCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBAN0oXk04jgFZtcx3P4OcKqEPK+Nba+4g
OCRLGaLwauRRR/EypKDYHWey+2fd74Dbt/suoNHXrlGuzuyxKMnnqKmGqczYf2Ua
Yo9IeeJjMiUja2qtjAyhPNbSj9lIdzuXvvkHBGxO6XZy8VMpnDgHyfcXJ/EUmNVk
ErcFoGF8wjCp0RCRnPvWu3pE3iE/JoP3wpYGDUnAej6kf0sGWgzf+iU503Oon66c
5PVOww6D8tcLB4ZNNfKU3GFs5ahthxVGpvrgrFpTgABAIbYIdkIt7rpKPLeUGN1o
VPSuANTD+cIEXtAX1IF5kcIyN4a9FJ2XiLwZmZMCccC7FS+XxOY3hOUCAwEAAaNT
MFEwHQYDVR0OBBYEFC+qwlIVc5Dz7V8PLuzk4DVRm6KfMB8GA1UdIwQYMBaAFC+q
wlIVc5Dz7V8PLuzk4DVRm6KfMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEL
BQADggEBAMP5rzRosX4QrTtlcPVIrcLI84O/pHpj7Zmz88FdlfCdX5W26RrjM5P/
Yi+mxX/dabyGpY4BeKUzBpgGHMlsYKSyBrhDstPD5GbfEO6DXBNNnBjOkerFuvV3
CrwU5rg01kYmM5eMF9dMIjLd56OPgRsAGu2vYtIphs2CtW3136APb0MHPzkIwTTF
ifxESJYBfxmaWoR9It7lu6N5pjnoMbkj3F/6kxgeP+urHwkaTsrOUjVFvZsDew/7
QzZKjZlC2J+UnBUzVp5x8445Svi5nXPcFOCZC4jOnwlyygVMIbw9dWTwXdQoLq6a
hZqupw5YAcA7g9us1mf1yziO1xZ9+aA=
-----END CERTIFICATE-----`;

const LEAF_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+LeEWi+qVJfOi
rGV5eXwslpszLkxDq/eaoy7Lb6jAXWEqUU/myddZWgtF6vA67Z59CLTZiivQTJOi
1JT8PvzlNQzBxrkKmzCPkLA1QmbuESSOKsAK0yCFB1ja5hvpuwHfpJOmJkWSHpai
6qImBjrXoPT1OPD3iS/Hp+S5JnZX3nUyGpE78UNbn0cGFKq5WRO1I4+PEi9ZfvER
dChWUWgu3A+Ke6+0Y8n1VELRWABEAvMQDSbX51XuXNc5PPjYF5Ed2t27YC/SLifQ
OYfIIe0q5sZO0032Irz3x1PVf2tdMKJ5KAC3QZZzfJmWPDZFSHeooeoHRybidwwC
cc3dNoKzAgMBAAECggEAPWVnXNWHwmXRrUs1qU1IgsaOTSwdr90lHvWehkvCcXPU
CgrdHjc8QBrbN9O8gXGz8E6uv+ok8ea+5Nr3TCXzk/WX7DkBBQUL3NVLpa4Nt76u
C/2OKRB216uDCowuJ7tZQ/+IMSP64szgObFA7sClH3bVjhM3a9qMo8q2gvWBUCUw
5BzHfvNhekuvF6uNpCZl3HJANmGvfOiL75t+iaTzcrBrDBwNUyAE85nSKrseLTvU
aXenVaJnDdd2r6qGXH8WaGV1U6sYjekVc/cHKY/g12aBaLXx4t/01nERDHu2Ma07
azz3LR0+w6nrSMLuVBI9Belj2qoGW29wpBDbkn/5qQKBgQDsr++FioXKtLFCnyMm
6eNp1IhL/3ljxEjnDqCKtrKqosDNdQve6lERNzNDOk3nCjTMD3/CftqL4nye9E1v
jlZT87bzRRPo0w6bKxyWEIHENb9XO2Ub6LZXDvWMK6sr4Nn7a48ZWbo8AfKIrcju
l8Cjzys8ptjav4dXva7XqzyMGQKBgQDNsnTDD8fxwAQ+6YD3Kq9fg6rJM2kG79sU
zuU7La7hXelNMm69UAycQJ8FFrTPBRxjLr+PUpX5Qztd4TUJavzDwx5oZQCYzYGy
r5kDZmM2/vmN1K7a9Gi9zAwmLgibf9q2wLwzIHfo0nZD9eu2qyuaLis1QYeUXDgK
nkTyiWoeqwKBgQDBXu/6k3TBaqTTwD4w4a9pXDlKldtwFgJVu86P5bnMzRFmCnV7
VsaKoSWhjDXvR5hhC1ye45Lb7FtSZlgJhymihx/2Wn5snlp1jWBaffv2+M5tj1oI
1jR6pf8Y2OiM/bQ5w+Nym6sasaCb6BecTqEVdAFoGQxck1QY7CC3lO/vqQKBgQCg
gPl/I5c+2jf15zpMozAI9bKUINt5IDvw9qgED1eAX0kmhY3HhujwG7R5wgf/6dsG
wXmUGjsQLxfp30sFOEhXcK8PgpB+qwzjIwXgk0ojpb2QoD54d3Ird0abnBv3SkKd
i7LOqi0mrOK/kOsGtHXnbtMkUSe76mGIV4sxPWxi1QKBgFqoumpJUhhSi/+hwSup
bLjdiyEI0vrwk5Gb9g5iWUy1/5ot7Z8+u+mqOq4tB4fHzllZ3j+VSyyTrI5CDFYj
49Q4dH6JKMh7nGxyoPvU8vpdMqFJCGDp8bZcirzrFTvHJ7Qv/GtickXeeN4x9LUO
VjlQRWGMb+efqVTE1gfHyizi
-----END PRIVATE KEY-----`;

const NOW = new Date('2030-06-01T12:00:00Z');
const CHAIN = parseCertificateChain(`${LEAF_PEM}\n${CA_PEM}`);

function sign(body: Buffer): string {
  const signer = createSign('RSA-SHA256');

  signer.update(body);

  return signer.sign(LEAF_KEY, 'base64');
}

describe('parseCertChainUrl', () => {
  it('accepts a URL in Amazon\'s bucket', () => {
    expect(parseCertChainUrl('https://s3.amazonaws.com/echo.api/echo-api-cert-7.pem').pathname)
      .toBe('/echo.api/echo-api-cert-7.pem');
  });

  it('accepts an explicit port 443', () => {
    expect(() => parseCertChainUrl('https://s3.amazonaws.com:443/echo.api/cert.pem')).not.toThrow();
  });

  it('rejects a missing header', () => {
    expect(() => parseCertChainUrl(undefined)).toThrow(AlexaVerificationError);
  });

  it('rejects a value that is not a URL', () => {
    expect(() => parseCertChainUrl('not a url')).toThrow(AlexaVerificationError);
  });

  it('rejects plain http', () => {
    expect(() => parseCertChainUrl('http://s3.amazonaws.com/echo.api/cert.pem')).toThrow(AlexaVerificationError);
  });

  it('rejects another host', () => {
    expect(() => parseCertChainUrl('https://evil.example.com/echo.api/cert.pem')).toThrow(AlexaVerificationError);
  });

  it('rejects a host that merely ends with the bucket name', () => {
    expect(() => parseCertChainUrl('https://nots3.amazonaws.com.evil.example.com/echo.api/cert.pem')).toThrow(AlexaVerificationError);
  });

  it('rejects a non-443 port', () => {
    expect(() => parseCertChainUrl('https://s3.amazonaws.com:8443/echo.api/cert.pem')).toThrow(AlexaVerificationError);
  });

  it('rejects a path outside /echo.api/', () => {
    expect(() => parseCertChainUrl('https://s3.amazonaws.com/other/cert.pem')).toThrow(AlexaVerificationError);
  });

  it('rejects a path that traverses out of /echo.api/', () => {
    expect(() => parseCertChainUrl('https://s3.amazonaws.com/echo.api/../other/cert.pem')).toThrow(AlexaVerificationError);
  });

  it('rejects a differently-cased path prefix', () => {
    expect(() => parseCertChainUrl('https://s3.amazonaws.com/ECHO.API/cert.pem')).toThrow(AlexaVerificationError);
  });
});

describe('parseCertificateChain', () => {
  it('reads every certificate in the chain, leaf first', () => {
    expect(CHAIN).toHaveLength(2);
    expect(CHAIN[0].subject).toContain('echo-api.amazon.com');
    expect(CHAIN[1].subject).toContain('Test Alexa CA');
  });

  it('rejects a body with no certificates in it', () => {
    expect(() => parseCertificateChain('<html>not a certificate</html>')).toThrow(AlexaVerificationError);
  });
});

describe('assertChainIsValid', () => {
  it('accepts a chain whose leaf is valid for echo-api.amazon.com', () => {
    expect(() => assertChainIsValid(CHAIN, NOW)).not.toThrow();
  });

  it('rejects a leaf that is not valid for echo-api.amazon.com', () => {
    expect(() => assertChainIsValid(parseCertificateChain(CA_PEM), NOW)).toThrow(/not valid for echo-api\.amazon\.com/);
  });

  it('rejects a chain that is not yet valid', () => {
    expect(() => assertChainIsValid(CHAIN, new Date('2000-01-01T00:00:00Z'))).toThrow(/validity window/);
  });

  it('rejects a chain that has expired', () => {
    expect(() => assertChainIsValid(CHAIN, new Date('2200-01-01T00:00:00Z'))).toThrow(/validity window/);
  });

  it('rejects a leaf that was not issued by the certificate above it', () => {
    expect(() => assertChainIsValid(parseCertificateChain(`${LEAF_PEM}\n${LEAF_PEM}`), NOW)).toThrow(/not issued by/);
  });
});

describe('assertSignatureIsValid', () => {
  const body = Buffer.from(JSON.stringify({ request: { type: 'IntentRequest' } }));

  it('accepts a signature over exactly the bytes received', () => {
    expect(() => assertSignatureIsValid(CHAIN[0], sign(body), body)).not.toThrow();
  });

  it('rejects a signature over a different body', () => {
    expect(() => assertSignatureIsValid(CHAIN[0], sign(Buffer.from('{}')), body)).toThrow(/does not match/);
  });

  it('rejects a body that has been altered after signing', () => {
    const signature = sign(body);
    const tampered = Buffer.from(JSON.stringify({ request: { type: 'LaunchRequest' } }));

    expect(() => assertSignatureIsValid(CHAIN[0], signature, tampered)).toThrow(/does not match/);
  });

  it('rejects a missing signature', () => {
    expect(() => assertSignatureIsValid(CHAIN[0], undefined, body)).toThrow(/no Signature-256/);
  });

  it('rejects a request whose raw body was never captured', () => {
    expect(() => assertSignatureIsValid(CHAIN[0], sign(body), undefined)).toThrow(/not captured/);
  });
});

describe('assertTimestampIsFresh', () => {
  it('accepts a timestamp from a moment ago', () => {
    expect(() => assertTimestampIsFresh(new Date(NOW.getTime() - 30 * 1000).toISOString(), NOW)).not.toThrow();
  });

  it('rejects a timestamp old enough to be a replay', () => {
    expect(() => assertTimestampIsFresh(new Date(NOW.getTime() - 151 * 1000).toISOString(), NOW)).toThrow(AlexaVerificationError);
  });

  it('rejects a timestamp too far in the future', () => {
    expect(() => assertTimestampIsFresh(new Date(NOW.getTime() + 151 * 1000).toISOString(), NOW)).toThrow(AlexaVerificationError);
  });

  it('rejects a missing timestamp', () => {
    expect(() => assertTimestampIsFresh(undefined, NOW)).toThrow(AlexaVerificationError);
  });

  it('rejects a timestamp that is not a date', () => {
    expect(() => assertTimestampIsFresh('yesterday', NOW)).toThrow(AlexaVerificationError);
  });
});

describe('assertApplicationIdMatches', () => {
  it('accepts our own skill', () => {
    expect(() => assertApplicationIdMatches('amzn1.ask.skill.abc', 'amzn1.ask.skill.abc')).not.toThrow();
  });

  it('rejects another skill', () => {
    expect(() => assertApplicationIdMatches('amzn1.ask.skill.other', 'amzn1.ask.skill.abc')).toThrow(AlexaVerificationError);
  });

  it('rejects a request with no applicationId', () => {
    expect(() => assertApplicationIdMatches(undefined, 'amzn1.ask.skill.abc')).toThrow(AlexaVerificationError);
  });
});
