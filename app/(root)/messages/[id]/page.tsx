import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

import ThreadChat from "@/components/forms/ThreadChat";
import { fetchUser } from "@/lib/actions/user.actions";
import { getOrCreateConversation } from "@/lib/actions/conversation.action";
import { CallHeaderActions } from "@/components/video-call/CallHeaderActions";

const Page = async ({ params }: { params: { id: string } }) => {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Fetch both user profiles in parallel
  const [currentUserInfo, otherUserInfo] = await Promise.all([
    fetchUser(user.id),
    fetchUser(params.id),
  ]);

  if (!currentUserInfo?.onboarded) redirect("/onboarding");
  if (!otherUserInfo) redirect("/messages");

  // getOrCreateConversation now returns the conversation _id string.
  // We pass it to ThreadChat so it can update the lastMessage preview.
  const conversationId = await getOrCreateConversation(user.id, params.id);

  // Room ID is deterministic and symmetric — same for both participants
  // const roomId = [user.id, otherUserInfo.id].sort().join("-");
  const roomId = [user.id, params.id].sort().join("-");


  const initials = otherUserInfo.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col">
      {/* ── Chat header ── */}
      <div className="sticky top-0 z-10 mb-4 flex items-center gap-3 rounded-2xl bg-dark-2/90 px-4 py-3 backdrop-blur-md">
        {/* Back button */}
        <Link
          href="/messages"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-1 transition-colors hover:bg-dark-3 hover:text-light-1"
          aria-label="Back to messages"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>

        {/* Avatar */}
        <Link href={`/profile/${otherUserInfo.id}`} className="relative shrink-0">
          <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-dark-4">
            {otherUserInfo.image ? (
              <Image
                src={otherUserInfo.image}
                fill
                sizes="40px"
                alt={`${otherUserInfo.name}'s avatar`}
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary-500/20 text-sm font-semibold text-primary-500">
                {initials}
              </div>
            )}
          </div>
          {/* Online indicator — can be wired to a presence system later */}
          <span
            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-dark-2 bg-green-500"
            aria-hidden="true"
          />
        </Link>

        {/* Name + status */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={`/profile/${otherUserInfo.id}`}
            className="truncate text-[15px] font-semibold text-light-1 hover:underline"
          >
            {otherUserInfo.name}
          </Link>
          <p className="text-[12px] font-medium text-green-500">connected</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <CallHeaderActions
            targetUserId={otherUserInfo.id}
            targetName={otherUserInfo.name}
          />

          <Link
            href={`/profile/${otherUserInfo.id}`}
            aria-label="View profile"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-1 transition-colors hover:bg-dark-3 hover:text-light-1"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Chat window ── */}
      <ThreadChat
        roomId={roomId}
        currentUser={currentUserInfo.name}
        currentUserId={user.id}
        anotherUserId={otherUserInfo.id}
        conversationId={conversationId}
      />
    </div>
  );
};

export default Page;