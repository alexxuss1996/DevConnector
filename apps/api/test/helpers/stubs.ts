import { mock } from "node:test";
import type { Mock } from "node:test";
import { Types } from "mongoose";

const restorers: Array<() => void> = [];

export type MockFn<T extends (...args: any[]) => any = (...args: any[]) => any> = Mock<T>;

export function newId(): Types.ObjectId {
  return new Types.ObjectId();
}

export interface UserDoc {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  avatar?: string;
  save: Mock<() => Promise<UserDoc>>;
}

export function mkUser(overrides: Partial<UserDoc> = {}): UserDoc {
  const user: UserDoc = {
    _id: newId(),
    name: "Test User",
    email: "test@example.com",
    passwordHash: undefined,
    googleId: undefined,
    avatar: "https://example.com/avatar.png",
    save: mock.fn(async function (this: UserDoc) {
      return this;
    }),
    ...overrides,
  };
  return user;
}

export interface SessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  refreshTokenHash?: string;
  expiresAt: Date;
  revokedAt?: Date;
}

export function mkSessionDoc(overrides: Partial<SessionDoc> = {}): SessionDoc & {
  save: () => Promise<any>;
} {
  const session: SessionDoc & { save: () => Promise<any> } = {
    _id: newId(),
    userId: newId(),
    refreshTokenHash: undefined,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    revokedAt: undefined,
    save: async function () {
      return session;
    },
    ...overrides,
  };
  return session;
}

type ChainableQuery<T> = Promise<T | null> & {
  select: (s: string) => ChainableQuery<T>;
  sort: () => ChainableQuery<T>;
  limit: () => ChainableQuery<T>;
  lean: () => ChainableQuery<T>;
  exec: () => Promise<T | null>;
};

export function mkQuery<T>(value: T | null): ChainableQuery<T> {
  const q = Promise.resolve(value) as ChainableQuery<T>;
  q.select = () => q;
  q.exec = () => Promise.resolve(value);
  q.sort = () => q;
  q.lean = () => q;
  q.limit = () => q;
  return q;
}

export function stubMethod<T extends object>(
  obj: T,
  name: keyof T,
  impl?: (...args: any[]) => any,
): Mock<any> {
  const m = mock.method(obj as any, name as any, impl as any);
  restorers.push(() => m.mock.restore());
  return m;
}

export function restoreAllStubs(): void {
  while (restorers.length > 0) {
    restorers.pop()!();
  }
}
