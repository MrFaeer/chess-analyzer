import { BadRequestException } from '@nestjs/common';

export function invalid(code: string): never {
  throw new BadRequestException({ code });
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('invalidInput');
  return value as Record<string, unknown>;
}

function text(body: Record<string, unknown>, key: string): string {
  if (typeof body[key] !== 'string') invalid('invalidInput');
  return body[key] as string;
}

export function parseLanguage(value: unknown): string {
  if (value !== 'en' && value !== 'ru' && value !== 'lv') invalid('invalidInput');
  return value;
}

export function registration(value: unknown) {
  const body = bodyObject(value);
  const login = text(body, 'login').trim();
  const email = text(body, 'email').trim();
  const password = text(body, 'password');
  if (!/^[A-Za-z0-9_]{3,32}$/.test(login)) invalid('invalidLogin');
  if (email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(email)) invalid('invalidEmail');
  if (password.length < 15 || password.length > 128) invalid('invalidPassword');
  if (password !== text(body, 'confirmPassword')) invalid('passwordMismatch');
  return { login, loginNormalized: login.toLowerCase(), email, emailNormalized: email.toLowerCase(), password, language: parseLanguage(body.language ?? 'en') };
}

export function credentials(value: unknown) {
  const body = bodyObject(value);
  const identifier = text(body, 'identifier').trim().toLowerCase();
  const password = text(body, 'password');
  if (!identifier || identifier.length > 254 || !password || password.length > 128) invalid('invalidCredentials');
  return { identifier, password };
}

export function preference(value: unknown) {
  return parseLanguage(bodyObject(value).language);
}
