import ThreadCard from "@/components/carde/ThreadCard";
import Comment from "@/components/forms/Comment";
import { fetchThread } from "@/lib/actions/thread.action";
import { fetchUser } from "@/lib/actions/user.actions";
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

const page = async ({ params }: { params: { id: string } }) => {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);

  if (!userInfo?.onboarded) redirect("/onboarding");

  const thread: any = await fetchThread(params.id);

  return (
    <section className="relative">
      <div>
        <ThreadCard
          key={thread._id}
          id={thread._id}
          currentUserId={thread?.id || ""}
          parenId={thread.parentId}
          comments={thread.children}
          createdAt={thread.createdAt}
          community={thread.community}
          author={thread.author}
          content={thread.text}
        />
      </div>
      <div>
        <Comment
          threadId={thread.id}
          currentUserImg={user.imageUrl}
          currentUserId={JSON.stringify(userInfo._id)}
        />
      </div>
      <div>
        {thread.children.map((childComment: any) => {
          return (
            <ThreadCard
              key={thread._id}
              id={thread._id}
              currentUserId={childComment?.id || ""}
              parenId={childComment.parentId}
              comments={childComment.children}
              createdAt={childComment.createdAt}
              community={childComment.community}
              author={childComment.author}
              content={childComment.text}
              isComment
            />
          );
        })}
      </div>
    </section>
  );
};

export default page;
