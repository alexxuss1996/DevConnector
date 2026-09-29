import type {
  RegisterUserInput,
  LoginUserInput,
  AuthResponse,
} from "@dev-conn/contracts";
import { ApiClient } from "@/lib/api/client";

export class AuthApiClient extends ApiClient {
  register(data: RegisterUserInput): Promise<AuthResponse> {
    return this.post<AuthResponse>("/auth/register", data);
  }

  login(data: LoginUserInput): Promise<AuthResponse> {
    return this.post<AuthResponse>("/auth/login", data);
  }

  logout(): Promise<void> {
    return this.post<void>("/auth/logout");
  }

  refresh(): Promise<AuthResponse> {
    return this.post<AuthResponse>("/auth/refresh");
  }
}

/** Shared instance bound to the default API URL. */
export const authApi = new AuthApiClient();

export type { AuthResponse };
