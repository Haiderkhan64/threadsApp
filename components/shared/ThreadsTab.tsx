import { fetchUserPost } from "@/lib/actions/user.actions";
import ThreadCard from "../carde/ThreadCard";
import { redirect } from "next/navigation";

interface Props {
  currentUserId: string;
  accountId: string;
  accountType: string;
}

const ThreadsTab = async ({ currentUserId, accountId, accountType }: Props) => {
  const result = await fetchUserPost(accountId);
  if (!result) redirect("/");
  return (
    <section className="mt-9 flex flex-col gap-10">
      {result.threads.map((thread: any) => {
        return (
          <ThreadCard
            key={thread._id}
            id={thread._id}
            currentUserId={currentUserId}
            parenId={thread.parentId}
            comments={thread.children}
            createdAt={thread.createdAt}
            community={thread.community}
            author={
              accountType === "User"
                ? { name: result.name, id: result.id, image: result.image }
                : {
                    name: thread.auther.name,
                    id: thread.auther.id,
                    image: thread.auther.image,
                  }
            }
            content={thread.text}
          />
        );
      })}
    </section>
  );
};

export default ThreadsTab;
