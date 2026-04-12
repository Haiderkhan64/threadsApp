"use client";

import { usePathname } from "next/navigation";
import { useTransition, useState } from "react";
import { joinCommunity, leaveCommunity } from "@/lib/actions/membership.action";

interface JoinCommunityButtonProps {
  communityId: string; // Clerk org id
  userId: string;      // Clerk user id
  isMember: boolean;
  isCreator: boolean;  // hide button for the community creator
}

export default function JoinCommunityButton({
  communityId,
  userId,
  isMember,
  isCreator,
}: JoinCommunityButtonProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [member, setMember] = useState(isMember);

  // Creator can't leave their own community
  if (isCreator) return null;

  const handleClick = () => {
    startTransition(async () => {
      if (member) {
        await leaveCommunity(communityId, userId, pathname);
        setMember(false);
      } else {
        await joinCommunity(communityId, userId, pathname);
        setMember(true);
      }

      // Hard reload is required so the Clerk session token is re-issued
      // with the updated organization list — router.refresh() alone is
      // not enough because the JWT is cached client-side until expiry.
      window.location.reload();
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`
        flex items-center gap-2 rounded-lg px-5 py-2 text-small-semibold
        transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
        ${
          member
            ? "border border-light-4 text-light-3 hover:border-red-500 hover:text-red-400 bg-transparent"
            : "bg-primary-500 text-light-1 hover:bg-primary-500/80"
        }
      `}
    >
      {isPending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {member ? "Leaving…" : "Joining…"}
        </>
      ) : member ? (
        "Leave"
      ) : (
        "Join"
      )}
    </button>
  );
}