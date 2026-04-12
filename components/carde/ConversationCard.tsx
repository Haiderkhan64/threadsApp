"use client";

import Image from "next/image";
import Link from "next/link";
import type { ConversationWithParticipant } from "@/lib/actions/conversation.action";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(isoString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface ConversationCardProps {
  conversation: ConversationWithParticipant;
}

export default function ConversationCard({ conversation }: ConversationCardProps) {
  const { otherUser, lastMessage, lastMessageAt } = conversation;
  const initials = otherUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      href={`/messages/${otherUser.id}`}
      className="group flex items-center gap-3.5 rounded-2xl px-4 py-3.5 transition-all duration-200 hover:bg-dark-3 active:scale-[0.99]"
    >
      {/* Avatar with online indicator */}
      <div className="relative shrink-0">
        <div className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-dark-4 ring-offset-1 ring-offset-dark-1 transition-all group-hover:ring-primary-500/40">
          {otherUser.image ? (
            <Image
              src={otherUser.image}
              fill
              sizes="48px"
              alt={otherUser.name}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary-500/20 text-sm font-semibold text-primary-500">
              {initials}
            </div>
          )}
        </div>
        {/* Online dot — can be wired to presence later */}
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-dark-1 bg-green-500" />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[15px] font-semibold text-light-1 leading-snug">
            {otherUser.name}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-gray-1 tabular-nums">
            {timeAgo(lastMessageAt)}
          </span>
        </div>
        <p className="truncate text-[13px] leading-relaxed text-light-4">
          {lastMessage || (
            <span className="italic text-dark-4/80">No messages yet</span>
          )}
        </p>
      </div>
    </Link>
  );
}