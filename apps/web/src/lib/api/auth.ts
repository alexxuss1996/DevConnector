import type {
  RegisterUserInput,
  LoginUserInput,
  AuthUser,
} from "@dev-conn/contracts";
import { ApiClient } from "./client";

export class AuthApiClient extends ApiClient {
  register(data: RegisterUserInput): Promise<AuthUser> {
    return this.post<AuthUser>("/auth/register", data);
  }

  login(data: LoginUserInput): Promise<AuthUser> {
    return this.post<AuthUser>("/auth/login", data);
  }

  logout(): Promise<void> {
    return this.post<void>("/auth/logout");
  }

  refresh(): Promise<AuthUser> {
    return this.post<AuthUser>("/auth/refresh");
  }
}

/** Shared instance bound to the default API URL. */
export const authApi = new AuthApiClient();

export type { AuthUser };
