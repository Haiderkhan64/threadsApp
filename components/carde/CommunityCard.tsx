import Image from "next/image";
import Link from "next/link";
import type { CommunityListItem } from "@/lib/actions/community.action";

interface Props {
  community: CommunityListItem;
}

export default function CommunityCard({ community }: Props) {
  return (
    <article className="community-card flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Link href={`/communities/${community.username}`} className="shrink-0">
          <div className="relative h-12 w-12">
            <Image
              src={community.image || "/assets/community.svg"}
              fill
              sizes="48px"
              alt={community.name}
              className="rounded-full object-cover"
            />
          </div>
        </Link>

        <div className="min-w-0">
          <Link href={`/communities/${community.username}`}>
            <h4 className="text-base-semibold text-light-1 hover:underline truncate">
              {community.name}
            </h4>
          </Link>
          <p className="text-small-medium text-gray-1">
            c/{community.username}
          </p>
        </div>
      </div>

      {community.bio && (
        <p className="text-subtle-medium text-light-3 line-clamp-2">
          {community.bio}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-subtle-medium text-gray-1">
          {community.memberCount}{" "}
          {community.memberCount === 1 ? "member" : "members"}
        </span>

        <Link
          href={`/communities/${community.username}`}
          className="rounded-lg bg-primary-500 px-4 py-1.5 text-small-semibold text-light-1 hover:bg-primary-500/80 transition-colors"
        >
          {community.isJoined ? "View" : "Join"}
        </Link>
      </div>
    </article>
  );
}