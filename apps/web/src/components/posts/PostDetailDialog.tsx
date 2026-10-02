"use client";

import { useState } from "react";
import { Textarea } from "@chakra-ui/react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import {
  useAddCommentMutation,
  useDeleteCommentMutation,
  useMyProfile,
  usePost,
  usePostComments,
  useUpdateCommentMutation,
} from "@/lib/queries";

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function errorDescription(err: unknown, fallback: string) {
  return err instanceof ApiError && err.requestId
    ? `${err.message} (request ${err.requestId})`
    : err instanceof Error
      ? err.message
      : fallback;
}

export function PostDetailDialog({ postId, onClose }: { postId: string; onClose: () => void }) {
  const isValidId = OBJECT_ID_RE.test(postId);
  const postQuery = usePost({ id: postId }, { enabled: isValidId });
  const commentsQuery = usePostComments({ id: postId }, { enabled: isValidId });
  const addComment = useAddCommentMutation();
  const updateComment = useUpdateCommentMutation();
  const deleteComment = useDeleteCommentMutation();
  const { data: me } = useMyProfile();
  const myId = me?.profile.userId._id;
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<{ text: string }>({ defaultValues: { text: "" } });

  const submitComment = async (values: { text: string }) => {
    if (!values.text.trim()) return;
    try {
      await addComment.mutateAsync({ params: { id: postId }, data: { text: values.text } });
      reset();
    } catch (err) {
      toaster.create({ title: "Could not add comment", description: errorDescription(err, "Try again"), type: "error" });
    }
  };

  const saveEdit = async (commentId: string, text: string) => {
    if (!text.trim()) return;
    try {
      await updateComment.mutateAsync({ params: { id: postId, commentId }, data: { text } });
      setEditingId(null);
    } catch (err) {
      toaster.create({ title: "Could not update comment", description: errorDescription(err, "Try again"), type: "error" });
    }
  };

  const removeComment = async (commentId: string) => {
    try {
      await deleteComment.mutateAsync({ id: postId, commentId });
    } catch (err) {
      toaster.create({ title: "Could not delete comment", description: errorDescription(err, "Try again"), type: "error" });
    }
  };

  return (
    <DialogRoot open onOpenChange={(e) => { if (!e.open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {!isValidId && (
            <EmptyState title="Post not found" description="That link is invalid." />
          )}
          {isValidId && postQuery.isLoading && <Skeleton height="20px" />}
          {isValidId && postQuery.error instanceof ApiError && postQuery.error.status === 404 && (
            <EmptyState title="Post not found" description="It may have been deleted." />
          )}
          {isValidId && postQuery.data && (
            <div style={{ display: "grid", gap: 16 }}>
              <p>{postQuery.data.post.text}</p>
              {commentsQuery.isLoading && <Skeleton height="20px" />}
              {(commentsQuery.data?.comments ?? []).map((comment) => (
                <div key={comment._id} style={{ display: "grid", gap: 4 }}>
                  <strong>{comment.name}</strong>
                  {editingId === comment._id ? (
                    <EditCommentForm
                      initialText={comment.text}
                      onCancel={() => setEditingId(null)}
                      onSave={(text) => void saveEdit(comment._id, text)}
                    />
                  ) : (
                    <>
                      <p>{comment.text}</p>
                      {comment.userId === myId && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(comment._id)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void removeComment(comment._id)}>
                            Delete
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              <form onSubmit={handleSubmit(submitComment)} style={{ display: "grid", gap: 8 }}>
                <Field label="Add a comment">
                  <Textarea
                    {...register("text", { validate: (v) => (v.trim() ? true : "Comment cannot be blank") })}
                    placeholder="Write a comment..."
                  />
                </Field>
                <Button type="submit" loading={isSubmitting} colorPalette="blue">
                  Comment
                </Button>
              </form>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}

function EditCommentForm({
  initialText,
  onCancel,
  onSave,
}: {
  initialText: string;
  onCancel: () => void;
  onSave: (text: string) => void;
}) {
  const { register, handleSubmit } = useForm<{ text: string }>({
    defaultValues: { text: initialText },
  });
  return (
    <form
      onSubmit={handleSubmit((v) => {
        if (v.text.trim()) onSave(v.text);
      })}
      style={{ display: "grid", gap: 8 }}
    >
      <Textarea {...register("text")} />
      <div style={{ display: "flex", gap: 8 }}>
        <Button type="submit" size="sm" colorPalette="blue">
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
