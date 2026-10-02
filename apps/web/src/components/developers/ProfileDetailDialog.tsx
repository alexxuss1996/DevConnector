"use client";

import { Avatar } from "@/components/ui/avatar";
import {
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag } from "@/components/ui/tag";
import { ApiError } from "@/lib/api/client";
import { useProfileById } from "@/lib/queries";

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export function ProfileDetailDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const isValidId = OBJECT_ID_RE.test(userId);
  const query = useProfileById({ id: userId }, { enabled: isValidId && userId !== "" });

  return (
    <DialogRoot open onOpenChange={(e) => { if (!e.open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Developer</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {!isValidId && (
            <EmptyState title="Developer not found" description="That link is invalid." />
          )}
          {isValidId && query.isLoading && <Skeleton height="20px" />}
          {isValidId && query.error instanceof ApiError && query.error.status === 404 && (
            <EmptyState title="Developer not found" description="That profile does not exist." />
          )}
          {isValidId && query.data && (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar name={query.data.profile.userId.name} />
                <div>
                  <strong>{query.data.profile.userId.name ?? "Developer"}</strong>
                  <p>{query.data.profile.status}</p>
                </div>
              </div>
              {query.data.profile.bio && <p>{query.data.profile.bio}</p>}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {query.data.profile.skills.map((skill) => (
                  <Tag key={skill}>{skill}</Tag>
                ))}
              </div>
              {query.data.profile.experience.length > 0 && (
                <section>
                  <h3>Experience</h3>
                  {query.data.profile.experience.map((exp, i) => (
                    <div key={exp._id ?? `${exp.title}-${i}`}>
                      <strong>{exp.title}</strong> at {exp.company}
                    </div>
                  ))}
                </section>
              )}
              {query.data.profile.education.length > 0 && (
                <section>
                  <h3>Education</h3>
                  {query.data.profile.education.map((edu, i) => (
                    <div key={edu._id ?? `${edu.school}-${i}`}>
                      <strong>{edu.school}</strong> — {edu.degree}
                    </div>
                  ))}
                </section>
              )}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
