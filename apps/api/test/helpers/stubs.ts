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
  sort: (...args: any[]) => ChainableQuery<T>;
  skip: (...args: any[]) => ChainableQuery<T>;
  limit: (...args: any[]) => ChainableQuery<T>;
  lean: () => ChainableQuery<T>;
  exec: () => Promise<T | null>;
  populate: (...args: any[]) => ChainableQuery<T>;
};

export function mkQuery<T>(value: T | null): ChainableQuery<T> {
  const q = Promise.resolve(value) as ChainableQuery<T>;
  q.select = () => q;
  q.exec = () => Promise.resolve(value);
  q.sort = () => q;
  q.skip = () => q;
  q.lean = () => q;
  q.limit = () => q;
  q.populate = () => q;
  return q;
}

export interface ProfileDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId | string;
  company?: string;
  website?: string;
  location?: string;
  status: string;
  skills: string[];
  bio?: string;
  githubusername?: string;
  social?: Record<string, string>;
  experience?: any[];
  education?: any[];
  createdAt?: Date;
  updatedAt?: Date;
  toJSON: () => Record<string, unknown>;
}

export function mkProfile(overrides: Partial<ProfileDoc> = {}): ProfileDoc {
  const doc: ProfileDoc = {
    _id: newId(),
    userId: newId(),
    status: "Developer",
    skills: ["JavaScript"],
    social: {},
    experience: [],
    education: [],
    toJSON() {
      const { toJSON, ...rest } = this as any;
      return { ...rest };
    },
    ...overrides,
  };
  // Ensure toJSON is always present even if overridden
  if (!doc.toJSON) {
    doc.toJSON = function () {
      const { toJSON, ...rest } = this as any;
      return { ...rest };
    };
  }
  return doc;
}

export interface PostDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  text: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  likes?: any[];
  comments?: any[];
  save: Mock<() => Promise<PostDoc>>;
  toJSON: () => Record<string, unknown>;
}

export interface CommentDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  text: string;
  name: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function mkComment(overrides: Partial<CommentDoc> = {}): CommentDoc {
  return {
    _id: newId(),
    userId: newId(),
    text: "Nice post!",
    name: "Commenter",
    avatar: "https://example.com/avatar.png",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function mkPost(overrides: Partial<PostDoc> = {}): PostDoc {
  const doc: PostDoc = {
    _id: newId(),
    userId: newId(),
    name: "Test User",
    text: "Hello world",
    avatar: "https://example.com/avatar.png",
    createdAt: new Date(),
    updatedAt: new Date(),
    likes: [],
    comments: [],
    save: mock.fn(async function (this: PostDoc) {
      return this;
    }),
    toJSON() {
      const { toJSON, save, ...rest } = this as any;
      return { ...rest };
    },
    ...overrides,
  };
  if (!doc.toJSON) {
    doc.toJSON = function () {
      const { toJSON, save, ...rest } = this as any;
      return { ...rest };
    };
  }
  if (!doc.save) {
    doc.save = mock.fn(async function (this: PostDoc) {
      return this;
    });
  }
  return doc;
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
