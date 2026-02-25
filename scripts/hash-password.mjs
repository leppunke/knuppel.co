#!/usr/bin/env node
/**
 * Generate a PBKDF2 password hash for STUDIO_PASSWORD_HASH env var.
 *
 * Usage:
 *   node scripts/hash-password.mjs "your-password-here"
 */

import { webcrypto } from "node:crypto";

const crypto = webcrypto;

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/hash-password.mjs \"your-password\"");
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));

const keyMaterial = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"]
);

const hash = await crypto.subtle.deriveBits(
  { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
  keyMaterial,
  256
);

const saltB64 = Buffer.from(salt).toString("base64");
const hashB64 = Buffer.from(hash).toString("base64");

const output = `${saltB64}:${hashB64}`;

console.log(output);
console.error("\nSet this as your STUDIO_PASSWORD_HASH environment variable.");
console.error("Also set AUTH_SECRET to a random string (e.g., openssl rand -base64 32).");
