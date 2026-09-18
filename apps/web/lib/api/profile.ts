import type {
  CreateProfileInput,
  AddExperienceInput,
  AddEducationInput,
  ProfileIdParams,
  GithubUsernameParams,
  ExperienceIdParams,
  EducationIdParams,
} from "@dev-conn/contracts";
import { apiFetch } from "./client";

// Shared response shapes derived from backend – kept in sync via contracts types for request validation
export type Profile = CreateProfileInput & {
  _id: string;
  userId: string;
  experience: Array<AddExperienceInput & { _id: string }>;
  education: Array<AddEducationInput & { _id: string }>;
  social: {
    youtube?: string;
    twitter?: string;
    facebook?: string;
    linkedin?: string;
    instagram?: string;
  };
};

export function createOrUpdateProfile(data: CreateProfileInput): Promise<Profile> {
  return apiFetch<Profile>("/profile/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getProfiles(): Promise<{ profiles: Profile[] }> {
  return apiFetch<{ profiles: Profile[] }>("/profile/");
}

export function getMyProfile(): Promise<{ profile: Profile }> {
  return apiFetch<{ profile: Profile }>("/profile/me");
}

export function getProfileById(params: ProfileIdParams): Promise<{ profile: Profile }> {
  return apiFetch<{ profile: Profile }>(`/profile/user/${params.id}`);
}

export function getGithubRepos(params: GithubUsernameParams): Promise<unknown> {
  return apiFetch<unknown>(`/profile/github/${params.username}`);
}

export function addExperience(data: AddExperienceInput): Promise<Profile> {
  return apiFetch<Profile>("/profile/experience", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteExperience(params: ExperienceIdParams): Promise<Profile> {
  return apiFetch<Profile>(`/profile/experience/${params.experienceId}`, {
    method: "DELETE",
  });
}

export function addEducation(data: AddEducationInput): Promise<Profile> {
  return apiFetch<Profile>("/profile/education", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteEducation(params: EducationIdParams): Promise<Profile> {
  return apiFetch<Profile>(`/profile/education/${params.educationId}`, {
    method: "DELETE",
  });
}

export function deleteProfile(): Promise<void> {
  return apiFetch<void>("/profile/", { method: "DELETE" });
}
