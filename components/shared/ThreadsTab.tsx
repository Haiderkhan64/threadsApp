import { fetchUserPosts } from "@/lib/actions/user.actions";
import { fetchCommunityPosts } from "@/lib/actions/community.action";
import ThreadCard from "../carde/ThreadCard";
import { redirect } from "next/navigation";

interface Props {
  currentUserId: string;
  accountId: string;
  accountType: "User" | "Community";
}

const ThreadsTab = async ({ currentUserId, accountId, accountType }: Props) => {
  const result =
    accountType === "Community"
      ? await fetchCommunityPosts(accountId)
      : await fetchUserPosts(accountId);

  if (!result) redirect("/");

  const threads: any[] = result.threads ?? [];

  return (
    <section className="mt-9 flex flex-col gap-10">
      {threads.length === 0 ? (
        <p className="no-result">No threads yet</p>
      ) : (
        threads.map((thread: any) => (
          <ThreadCard
            key={thread._id}
            id={thread._id}
            currentUserId={currentUserId}
            parentId={thread.parentId}
            comments={thread.children ?? []}
            createdAt={thread.createdAt}
            community={thread.community ?? null}
            author={
              accountType === "Community"
                ? {
                    name: thread.author?.name,
                    id: thread.author?.id,
                    image: thread.author?.image,
                  }
                : {
                    name: result.name,
                    id: result.id,
                    image: result.image,
                  }
            }
            content={thread.text}
            images={thread.images ?? []}
          />
        ))
      )}
    </section>
  );
};

export default ThreadsTab;