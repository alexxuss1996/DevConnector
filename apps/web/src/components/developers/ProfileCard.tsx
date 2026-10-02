"use client";

import type { PublicProfileSummary } from "@dev-conn/contracts";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";

export function ProfileCard({
  profile,
  onOpen,
}: {
  profile: PublicProfileSummary;
  onOpen: (userId: string) => void;
}) {
  return (
    <article data-testid="profile-card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar name={profile.userId.name} />
      <div style={{ display: "grid", gap: 4 }}>
        <button
          type="button"
          data-testid="profile-open"
          onClick={() => onOpen(profile.userId._id)}
          style={{ textAlign: "left", cursor: "pointer", background: "none", border: "none", padding: 0, fontWeight: "bold" }}
        >
          {profile.userId.name ?? "Developer"}
        </button>
        <span>{profile.status}</span>
        {[profile.company, profile.location].filter(Boolean).join(" · ") && (
          <span>{[profile.company, profile.location].filter(Boolean).join(" · ")}</span>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {profile.skills.map((skill) => (
            <Tag key={skill}>{skill}</Tag>
          ))}
        </div>
      </div>
    </article>
  );
}
