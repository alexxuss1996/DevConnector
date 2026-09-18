import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type {
  RegisterUserInput,
  LoginUserInput,
  CreateProfileInput,
  AddExperienceInput,
  AddEducationInput,
  CreatePostInput,
  CreatePostCommentInput,
  UpdatePostCommentInput,
  ProfileIdParams,
  PostIdParams,
  PostCommentIdParams,
} from "@dev-conn/contracts";
import { authApi } from "../api/auth";
import { profileApi, type Profile } from "../api/profile";
import { postsApi, type Post } from "../api/posts";

// Auth queries/mutations
export function useRegisterMutation() {
  return useMutation({
    mutationFn: (data: RegisterUserInput) => authApi.register(data),
  });
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: (data: LoginUserInput) => authApi.login(data),
  });
}

export function useLogoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => qc.clear(),
  });
}

// Profile queries/mutations – shared contract types drive params & body
export function useProfiles(options?: Omit<UseQueryOptions<{ profiles: Profile[] }>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["profiles"] as const,
    queryFn: () => profileApi.getProfiles(),
    ...options,
  });
}

export function useMyProfile(options?: Omit<UseQueryOptions<{ profile: Profile }>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["profile", "me"] as const,
    queryFn: () => profileApi.getMyProfile(),
    ...options,
  });
}

export function useProfileById(params: ProfileIdParams, options?: Omit<UseQueryOptions<{ profile: Profile }>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["profile", params.id] as const,
    queryFn: () => profileApi.getProfileById(params),
    ...options,
  });
}

export function useCreateProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProfileInput) => profileApi.createOrUpdateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useAddExperienceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddExperienceInput) => profileApi.addExperience(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useDeleteExperienceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { experienceId: string }) => profileApi.deleteExperience(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useAddEducationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddEducationInput) => profileApi.addEducation(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useDeleteEducationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { educationId: string }) => profileApi.deleteEducation(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

// Posts queries/mutations
export function usePosts(options?: Omit<UseQueryOptions<{ posts: Post[] }>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["posts"] as const,
    queryFn: () => postsApi.getPosts(),
    ...options,
  });
}

export function usePost(params: PostIdParams, options?: Omit<UseQueryOptions<{ post: Post }>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["post", params.id] as const,
    queryFn: () => postsApi.getPost(params),
    ...options,
  });
}

export function usePostComments(params: PostIdParams, options?: Omit<UseQueryOptions<{ comments: Post["comments"] }>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: ["post", params.id, "comments"] as const,
    queryFn: () => postsApi.getPostComments(params),
    ...options,
  });
}

export function useCreatePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePostInput) => postsApi.createPost(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function useDeletePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: PostIdParams) => postsApi.deletePost(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function useAddCommentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ params, data }: { params: PostIdParams; data: CreatePostCommentInput }) =>
      postsApi.addComment(params, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["post", vars.params.id] }),
  });
}

export function useUpdateCommentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ params, data }: { params: PostCommentIdParams; data: UpdatePostCommentInput }) =>
      postsApi.updateComment(params, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["post", vars.params.id] }),
  });
}

export function useDeleteCommentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: PostCommentIdParams) => postsApi.deleteComment(params),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["post", vars.id] }),
  });
}

export function useLikePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: PostIdParams) => postsApi.likePost(params),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["post", vars.id] }),
  });
}

export function useUnlikePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: PostIdParams) => postsApi.unlikePost(params),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["post", vars.id] }),
  });
}
