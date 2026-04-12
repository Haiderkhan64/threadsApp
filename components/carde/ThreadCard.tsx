import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { formatDateString } from "@/lib/utils";
import { cn } from "@/lib/utils";
import DeleteThreadButton from "./DeleteThreadButton";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_VISIBLE_REPLY_AVATARS = 3;

const THREAD_ACTIONS = [
  { src: "/assets/heart-gray.svg", label: "Like" },
  { src: "/assets/repost.svg", label: "Repost" },
  { src: "/assets/share.svg", label: "Share" },
] as const satisfies ReadonlyArray<{ src: string; label: string }>;

// ── Domain Types ──────────────────────────────────────────────────────────────

export interface ThreadAuthor {
  id: string;
  name: string;
  image: string;
}

export interface ThreadCommunity {
  id: string;
  name: string;
  image: string;
}

export interface ThreadComment {
  author: Pick<ThreadAuthor, "image">;
}

export interface ThreadCardProps {
  id: string;
  currentUserId: string;
  parentId: string | null;
  content: string;
  author: ThreadAuthor;
  community: ThreadCommunity | null;
  createdAt: string;
  comments: ThreadComment[];
  isComment?: boolean;
  images?: string[]; // ← new: UploadThing URLs
}

// ── AuthorAvatar ──────────────────────────────────────────────────────────────

const AuthorAvatar = memo(function AuthorAvatar({
  author,
  showConnector,
}: {
  author: ThreadAuthor;
  showConnector: boolean;
}) {
  return (
    <div className="flex flex-col items-center" aria-hidden="true">
      <Link
        href={`/profile/${author.id}`}
        className="relative h-11 w-11 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-full"
        tabIndex={-1}
      >
        <Image
          src={author.image}
          fill
          sizes="44px"
          alt={`${author.name}'s avatar`}
          className="rounded-full object-cover"
          priority={false}
        />
      </Link>
      {showConnector && <div className="thread-card_bar mt-2" role="presentation" />}
    </div>
  );
});

// ── ThreadImages ──────────────────────────────────────────────────────────────

const ThreadImages = memo(function ThreadImages({
  images,
  threadId,
}: {
  images: string[];
  threadId: string;
}) {
  if (!images || images.length === 0) return null;

  const count = images.length;

  if (count === 1) {
    return (
      <Link href={`/thread/${threadId}`} className="block mt-3 overflow-hidden rounded-xl">
        <div className="relative w-full overflow-hidden rounded-xl bg-dark-4" style={{ aspectRatio: "16/9" }}>
          <Image
            src={images[0]}
            fill
            sizes="(max-width: 768px) 100vw, 700px"
            alt="Thread image"
            className="object-cover hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      </Link>
    );
  }

  if (count === 2) {
    return (
      <Link href={`/thread/${threadId}`} className="block mt-3">
        <div className="grid grid-cols-2 gap-1.5 overflow-hidden rounded-xl">
          {images.map((src, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl bg-dark-4" style={{ aspectRatio: "1/1" }}>
              <Image
                src={src}
                fill
                sizes="350px"
                alt={`Thread image ${i + 1}`}
                className="object-cover hover:scale-[1.02] transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      </Link>
    );
  }

  if (count === 3) {
    return (
      <Link href={`/thread/${threadId}`} className="block mt-3">
        <div className="grid gap-1.5 overflow-hidden rounded-xl" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
          {/* First image: left column, full height */}
          <div className="relative overflow-hidden rounded-xl bg-dark-4" style={{ gridRow: "1 / 3", aspectRatio: "1/1" }}>
            <Image src={images[0]} fill sizes="350px" alt="Thread image 1" className="object-cover hover:scale-[1.02] transition-transform duration-300" />
          </div>
          {/* Second and third: right column stacked */}
          {[images[1], images[2]].map((src, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl bg-dark-4" style={{ aspectRatio: "2/1" }}>
              <Image src={src} fill sizes="175px" alt={`Thread image ${i + 2}`} className="object-cover hover:scale-[1.02] transition-transform duration-300" />
            </div>
          ))}
        </div>
      </Link>
    );
  }

  // 4 images: 2×2 grid
  return (
    <Link href={`/thread/${threadId}`} className="block mt-3">
      <div className="grid grid-cols-2 gap-1.5 overflow-hidden rounded-xl">
        {images.slice(0, 4).map((src, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl bg-dark-4" style={{ aspectRatio: "1/1" }}>
            <Image
              src={src}
              fill
              sizes="350px"
              alt={`Thread image ${i + 1}`}
              className="object-cover hover:scale-[1.02] transition-transform duration-300"
            />
            {/* Overlay for 4th image if more than 4 exist */}
            {i === 3 && images.length > 4 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                <span className="text-white font-bold text-xl">+{images.length - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Link>
  );
});

// ── ReplyAvatars ──────────────────────────────────────────────────────────────

const ReplyAvatars = memo(function ReplyAvatars({
  comments,
  threadId,
}: {
  comments: ThreadComment[];
  threadId: string;
}) {
  if (comments.length === 0) return null;
  const visible = comments.slice(0, MAX_VISIBLE_REPLY_AVATARS);
  const replyCount = comments.length;
  const replyLabel = replyCount === 1 ? "reply" : "replies";
  return (
    <Link href={`/thread/${threadId}`} className="mt-1 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded" aria-label={`View ${replyCount} ${replyLabel}`}>
      <div className="flex -space-x-2" aria-hidden="true">
        {visible.map((comment, index) => (
          <div key={index} className="relative h-5 w-5 rounded-full ring-2 ring-dark-2">
            <Image src={comment.author.image} fill sizes="20px" alt="" className="rounded-full object-cover" />
          </div>
        ))}
      </div>
      <p className="text-subtle-medium text-gray-1">{replyCount} {replyLabel}</p>
    </Link>
  );
});

// ── CommunityBadge ────────────────────────────────────────────────────────────

const CommunityBadge = memo(function CommunityBadge({
  community,
  createdAt,
}: {
  community: ThreadCommunity;
  createdAt: string;
}) {
  return (
    <Link href={`/communities/${community.id}`} className="mt-5 flex shrink-0 items-center gap-1.5 self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
      <p className="text-subtle-medium text-gray-1">
        <time dateTime={createdAt}>{formatDateString(createdAt)}</time>
        {" · "}
        <span>{community.name}</span>
      </p>
      <div className="relative h-4 w-4" aria-hidden="true">
        <Image src={community.image} fill sizes="16px" alt="" className="rounded-full object-cover" />
      </div>
    </Link>
  );
});

// ── ThreadActions ─────────────────────────────────────────────────────────────

const ThreadActions = memo(function ThreadActions({
  threadId,
  isComment,
  comments,
}: {
  threadId: string;
  isComment: boolean;
  comments: ThreadComment[];
}) {
  return (
    <div className={cn("mt-5 flex flex-col gap-3", isComment && "mb-10")}>
      <div className="flex items-center gap-3.5" role="toolbar" aria-label="Thread actions">
        {THREAD_ACTIONS.map(({ src, label }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            className="rounded p-0.5 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Image src={src} alt="" width={24} height={24} aria-hidden="true" className="object-contain" />
          </button>
        ))}
        <Link
          href={`/thread/${threadId}`}
          aria-label="Reply to thread"
          className="rounded p-0.5 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Image src="/assets/reply.svg" alt="" width={24} height={24} aria-hidden="true" className="object-contain" />
        </Link>
      </div>
      {isComment && <ReplyAvatars comments={comments} threadId={threadId} />}
    </div>
  );
});

// ── ThreadCard ────────────────────────────────────────────────────────────────

export default memo(function ThreadCard({
  id,
  currentUserId,
  parentId: _parentId,
  content,
  author,
  community,
  createdAt,
  comments,
  isComment = false,
  images = [],
}: ThreadCardProps) {
  const isOwnThread = currentUserId === author.id;

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl",
        isComment ? "px-0 xs:px-7" : "bg-dark-2 p-7"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex w-full flex-1 flex-row gap-4">
          <AuthorAvatar author={author} showConnector={comments.length > 0} />

          <div className="flex w-full flex-col">
            <Link
              href={`/profile/${author.id}`}
              className="w-fit hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              <h4 className="text-base-semibold text-light-1">{author.name}</h4>
            </Link>

            <p className="mt-2 text-small-regular text-light-2 leading-relaxed">{content}</p>

            {/* ── Images ── */}
            {images.length > 0 && (
              <ThreadImages images={images} threadId={id} />
            )}

            <ThreadActions threadId={id} isComment={isComment} comments={comments} />
          </div>
        </div>

        {!isComment && (isOwnThread || community) && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {isOwnThread && <DeleteThreadButton threadId={id} />}
            {community && <CommunityBadge community={community} createdAt={createdAt} />}
          </div>
        )}
      </div>
    </article>
  );
});