"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { joinCommunity, leaveCommunity } from "@/lib/actions/community.action";

interface Props {
  communityId: string; // MongoDB _id
  clerkUserId: string;
  initialIsMember: boolean;
  isCreator: boolean;
}

export default function JoinLeaveButton({
  communityId,
  clerkUserId,
  initialIsMember,
  isCreator,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isMember, setIsMember] = useState(initialIsMember);
  const [error, setError] = useState("");

  // Creator is always a member — they can delete but not leave
  if (isCreator) return null;

  const handleClick = () => {
    setError("");
    startTransition(async () => {
      try {
        if (isMember) {
          await leaveCommunity(communityId, clerkUserId, pathname);
          setIsMember(false);
        } else {
          await joinCommunity(communityId, clerkUserId, pathname);
          setIsMember(true);
        }
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Something went wrong");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`
          flex items-center gap-2 rounded-lg px-5 py-2 text-small-semibold
          transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
          ${
            isMember
              ? "border border-light-4 bg-transparent text-light-3 hover:border-red-500 hover:text-red-400"
              : "bg-primary-500 text-light-1 hover:bg-primary-500/80"
          }
        `}
      >
        {isPending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {isMember ? "Leaving…" : "Joining…"}
          </>
        ) : isMember ? (
          "Leave"
        ) : (
          "Join"
        )}
      </button>
      {error && (
        <p className="text-tiny-medium text-red-400">{error}</p>
      )}
    </div>
  );
}