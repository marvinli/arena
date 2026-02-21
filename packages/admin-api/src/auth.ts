import * as jose from "jose";

const region = process.env.AWS_REGION ?? "us-east-1";
const userPoolId = process.env.COGNITO_USER_POOL_ID ?? "";
const clientId = process.env.COGNITO_CLIENT_ID ?? "";

const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
const jwksUrl = new URL(`${issuer}/.well-known/jwks.json`);

let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(jwksUrl);
  }
  return jwks;
}

const ALLOWED_EMAILS = ["marvinli@gmail.com"];

export interface AuthUser {
  sub: string;
  email: string;
}

export async function verifyToken(token: string): Promise<AuthUser> {
  const { payload } = await jose.jwtVerify(token, getJwks(), {
    issuer,
    audience: clientId,
  });
  const email = (payload.email as string | undefined)?.toLowerCase();
  if (!email || !ALLOWED_EMAILS.includes(email)) {
    throw new Error("Forbidden");
  }
  return { sub: payload.sub as string, email };
}
