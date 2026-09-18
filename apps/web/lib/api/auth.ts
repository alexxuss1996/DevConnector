import type {
  RegisterUserInput,
  LoginUserInput,
  AuthUser,
} from "@dev-conn/contracts";
import { apiFetch } from "./client";

export function register(data: RegisterUserInput): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function login(data: LoginUserInput): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function refresh(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/refresh", { method: "POST" });
}
