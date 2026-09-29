import type {
  CreateProfileInput,
  UpdateProfileInput,
  AddExperienceInput,
  AddEducationInput,
  ProfileIdParams,
  ExperienceIdParams,
  EducationIdParams,
  PublicProfile,
  PublicProfileSummary,
} from "@dev-conn/contracts";
import { ApiClient, toQuery, type PaginationParams } from "@/lib/api/client";

export class ProfileApiClient extends ApiClient {
  createProfile(data: CreateProfileInput): Promise<{ profile: PublicProfile }> {
    return this.post<{ profile: PublicProfile }>("/profiles/", data);
  }

  updateProfile(data: UpdateProfileInput): Promise<{ profile: PublicProfile }> {
    return this.patch<{ profile: PublicProfile }>("/profiles/", data);
  }

  getProfiles(
    params: PaginationParams = {},
  ): Promise<{ profiles: PublicProfileSummary[]; total: number; page: number; limit: number }> {
    return this.get<{
      profiles: PublicProfileSummary[];
      total: number;
      page: number;
      limit: number;
    }>(`/profiles/${toQuery(params)}`);
  }

  getMyProfile(): Promise<{ profile: PublicProfile }> {
    return this.get<{ profile: PublicProfile }>("/profiles/me");
  }

  getProfileById(params: ProfileIdParams): Promise<{ profile: PublicProfile }> {
    return this.get<{ profile: PublicProfile }>(`/profiles/user/${params.id}`);
  }

  addExperience(data: AddExperienceInput): Promise<{ profile: PublicProfile }> {
    return this.post<{ profile: PublicProfile }>("/profiles/experience", data);
  }

  deleteExperience(params: ExperienceIdParams): Promise<{ profile: PublicProfile }> {
    return this.delete<{ profile: PublicProfile }>(`/profiles/experience/${params.experienceId}`);
  }

  addEducation(data: AddEducationInput): Promise<{ profile: PublicProfile }> {
    return this.post<{ profile: PublicProfile }>("/profiles/education", data);
  }

  deleteEducation(params: EducationIdParams): Promise<{ profile: PublicProfile }> {
    return this.delete<{ profile: PublicProfile }>(`/profiles/education/${params.educationId}`);
  }

  deleteProfile(): Promise<void> {
    return this.delete<void>("/profiles/");
  }
}

/** Shared instance bound to the default API URL. */
export const profileApi = new ProfileApiClient();
