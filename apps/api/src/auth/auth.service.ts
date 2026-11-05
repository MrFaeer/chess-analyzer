import { ConflictException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { hashPassword, verifyPassword } from './password';
import { credentials, registration } from './auth.dto';

const userFields = { id: true, login: true, email: true, emailVerifiedAt: true, language: true } as const;
export type CurrentUser = Prisma.UserGetPayload<{ select: typeof userFields }>;
export type AuthRequest = Request & { currentUser?: CurrentUser };
const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const windowMs = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  readonly origin: string;
  readonly secure = process.env.NODE_ENV === 'production';
  readonly cookieName = this.secure ? '__Secure-chess_session' : 'chess_session';
  private readonly attempts = new Map<string, { count: number; until: number }>();
  private activeHashes = 0;

  constructor(private readonly prisma: PrismaService) {
    const configured = process.env.APP_ORIGIN ?? (this.secure ? '' : 'http://127.0.0.1:5173');
    const url = new URL(configured);
    if (url.origin !== configured || !['http:', 'https:'].includes(url.protocol) || (this.secure && url.protocol !== 'https:')) {
      throw new Error('APP_ORIGIN must be an exact origin (HTTPS in production), without a trailing slash.');
    }
    this.origin = url.origin;
  }

  private limited(): never {
    throw new HttpException({ code: 'rateLimited' }, 429);
  }

  limit(key: string, maximum: number) {
    const now = Date.now();
    for (const [entry, value] of this.attempts) if (value.until <= now) this.attempts.delete(entry);
    const value = this.attempts.get(key);
    if (!value && this.attempts.size >= 10000) this.limited();
    if (value && value.count >= maximum) this.limited();
    this.attempts.set(key, { count: (value?.count ?? 0) + 1, until: value?.until ?? now + windowMs });
  }

  private async passwordWork<T>(work: () => Promise<T>): Promise<T> {
    // Bound concurrent 128 MiB derivations instead of growing an unbounded queue.
    if (this.activeHashes >= 2) this.limited();
    this.activeHashes++;
    try { return await work(); } finally { this.activeHashes--; }
  }

  private tokenHash(request: Request): string | null {
    const values = (request.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${this.cookieName}=`));
    if (values.length !== 1) return null;
    const token = values[0].slice(this.cookieName.length + 1);
    return /^[a-f0-9]{64}$/.test(token) ? createHash('sha256').update(token).digest('hex') : null;
  }

  async current(request: Request): Promise<CurrentUser | null> {
    const tokenHash = this.tokenHash(request);
    if (!tokenHash) return null;
    const session = await this.prisma.session.findUnique({ where: { tokenHash }, include: { user: { select: userFields } } });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return session.user;
  }

  private cookieOptions() {
    return { httpOnly: true, secure: this.secure, sameSite: 'lax' as const, path: '/api' };
  }

  private async createSession(tx: Prisma.TransactionClient, userId: string, request: Request) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const previous = this.tokenHash(request);
    const expiresAt = new Date(Date.now() + sessionDuration);
    // Remove expired sessions opportunistically for the signing-in user.
    await tx.session.deleteMany({ where: { OR: [{ userId, expiresAt: { lte: new Date() } }, ...(previous ? [{ tokenHash: previous }] : [])] } });
    await tx.session.create({ data: { tokenHash, userId, expiresAt } });
    return { token, expiresAt };
  }

  private setCookie(response: Response, session: { token: string; expiresAt: Date }) {
    response.cookie(this.cookieName, session.token, { ...this.cookieOptions(), maxAge: sessionDuration, expires: session.expiresAt });
  }

  async register(body: unknown, request: Request, response: Response) {
    const { password, ...data } = registration(body);
    const passwordHash = await this.passwordWork(() => hashPassword(password));
    try {
      const result = await this.prisma.$transaction(async tx => {
        const user = await tx.user.create({ data: { ...data, passwordHash }, select: userFields });
        return { user, session: await this.createSession(tx, user.id, request) };
      });
      this.setCookie(response, result.session);
      return result.user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'accountExists' });
      }
      throw error;
    }
  }

  async login(body: unknown, request: Request, response: Response) {
    const { identifier, password } = credentials(body);
    this.limit(`identifier:${createHash('sha256').update(identifier).digest('hex')}`, 10);
    const user = identifier.includes('@')
      ? await this.prisma.user.findUnique({ where: { emailNormalized: identifier } })
      : await this.prisma.user.findUnique({ where: { loginNormalized: identifier } });
    if (!await this.passwordWork(() => verifyPassword(password, user?.passwordHash ?? null)) || !user) {
      throw new UnauthorizedException({ code: 'invalidCredentials' });
    }
    const session = await this.prisma.$transaction(tx => this.createSession(tx, user.id, request));
    this.setCookie(response, session);
    return this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: userFields });
  }

  async logout(request: Request, response: Response) {
    const tokenHash = this.tokenHash(request);
    if (tokenHash) await this.prisma.session.deleteMany({ where: { tokenHash } });
    response.clearCookie(this.cookieName, this.cookieOptions());
  }

  async language(userId: string, language: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { language }, select: userFields });
  }
}
