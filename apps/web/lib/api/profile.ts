import type {
  CreateProfileInput,
  UpdateProfileInput,
  AddExperienceInput,
  AddEducationInput,
  ProfileIdParams,
  GithubUsernameParams,
  ExperienceIdParams,
  EducationIdParams,
  Profile,
} from "@dev-conn/contracts";
import { ApiClient, toQuery, type PaginationParams } from "./client";

export class ProfileApiClient extends ApiClient {
  createOrUpdateProfile(data: CreateProfileInput): Promise<{ profile: Profile }> {
    return this.post<{ profile: Profile }>("/profile/", data);
  }

  updateProfile(data: UpdateProfileInput): Promise<{ profile: Profile }> {
    return this.put<{ profile: Profile }>("/profile/", data);
  }

  getProfiles(params: PaginationParams = {}): Promise<{ profiles: Profile[] }> {
    return this.get<{ profiles: Profile[] }>(`/profile/${toQuery(params)}`);
  }

  getMyProfile(): Promise<{ profile: Profile }> {
    return this.get<{ profile: Profile }>("/profile/me");
  }

  getProfileById(params: ProfileIdParams): Promise<{ profile: Profile }> {
    return this.get<{ profile: Profile }>(`/profile/user/${params.id}`);
  }

  getGithubRepos(params: GithubUsernameParams): Promise<unknown> {
    return this.get<unknown>(`/profile/github/${params.username}`);
  }

  addExperience(data: AddExperienceInput): Promise<{ profile: Profile }> {
    return this.post<{ profile: Profile }>("/profile/experience", data);
  }

  deleteExperience(params: ExperienceIdParams): Promise<{ profile: Profile }> {
    return this.delete<{ profile: Profile }>(`/profile/experience/${params.experienceId}`);
  }

  addEducation(data: AddEducationInput): Promise<{ profile: Profile }> {
    return this.post<{ profile: Profile }>("/profile/education", data);
  }

  deleteEducation(params: EducationIdParams): Promise<{ profile: Profile }> {
    return this.delete<{ profile: Profile }>(`/profile/education/${params.educationId}`);
  }

  deleteProfile(): Promise<void> {
    return this.delete<void>("/profile/");
  }
}

/** Shared instance bound to the default API URL. */
export const profileApi = new ProfileApiClient();
