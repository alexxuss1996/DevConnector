import type {
  CreateProfileInput,
  AddExperienceInput,
  AddEducationInput,
  ProfileIdParams,
  GithubUsernameParams,
  ExperienceIdParams,
  EducationIdParams,
} from "@dev-conn/contracts";
import { ApiClient, toQuery, type PaginationParams } from "./client";

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

export class ProfileApiClient extends ApiClient {
  createOrUpdateProfile(data: CreateProfileInput): Promise<{ profile: Profile }> {
    return this.post<{ profile: Profile }>("/profile/", data);
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
