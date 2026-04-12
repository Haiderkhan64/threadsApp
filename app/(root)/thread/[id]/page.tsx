import { notFound, redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";
import type { Metadata } from "next";

import ThreadCard from "@/components/carde/ThreadCard";
import Comment from "@/components/forms/Comment";
import { fetchThread } from "@/lib/actions/thread.action";
import { fetchUser } from "@/lib/actions/user.actions";
import { isCommunityMember } from "@/lib/actions/community.action";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const thread = await fetchThread(params.id);
  if (!thread) return { title: "Thread not found" };
  return {
    title: `${thread.author.name} on Thread`,
    description: thread.text.slice(0, 160),
  };
}

export default async function ThreadPage({ params }: PageProps) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const [userInfo, thread] = await Promise.all([
    fetchUser(user.id),
    fetchThread(params.id),
  ]);

  if (!userInfo?.onboarded) redirect("/onboarding");
  if (!thread) notFound();

  // If this thread belongs to a private community, gate non-members
  if (thread.community) {
    const canView = await isCommunityMember(thread.community._id, user.id);
    if (!canView) {
      return (
        <section className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="text-heading4-medium text-light-1">Members only</p>
          <p className="text-base-regular text-light-3">
            Join{" "}
            <span className="text-primary-500">
              c/{thread.community.username}
            </span>{" "}
            to read this thread.
          </p>
        </section>
      );
    }
  }

  return (
    <section className="relative">
      <ThreadCard
        id={thread._id}
        currentUserId={user.id}
        parentId={thread.parentId}
        content={thread.text}
        author={thread.author}
        community={thread.community ?? null}
        createdAt={thread.createdAt}
        comments={thread.children ?? []}
        images={thread.images ?? []}
      />

      <div className="mt-7">
        <Comment
          threadId={params.id}
          currentUserImg={user.imageUrl}
          currentUserId={user.id}
        />
      </div>

      {thread.children?.length > 0 && (
        <section className="mt-10 flex flex-col gap-4" aria-label="Replies">
          {thread.children.map((comment: any) => (
            <ThreadCard
              key={comment._id}
              id={comment._id}
              currentUserId={user.id}
              parentId={comment.parentId}
              content={comment.text}
              author={comment.author}
              community={comment.community ?? null}
              createdAt={comment.createdAt}
              comments={comment.children ?? []}
              isComment
              images={comment.images ?? []} 
            />
          ))}
        </section>
      )}
    </section>
  );
}