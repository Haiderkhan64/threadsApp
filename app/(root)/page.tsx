import ThreadCard from "@/components/carde/ThreadCard";
import { fetchPost } from "@/lib/actions/thread.action";
import { currentUser } from "@clerk/nextjs";

export default async function Home() {
  const user = await currentUser();
  // Pass clerk ID so the feed includes community posts for joined communities
  const result = await fetchPost(1, 20, user?.id);

  return (
    <>
      <h1 className="head-text text-left">Home</h1>
      <section className="mt-9 flex flex-col gap-10">
        {result.posts.length === 0 ? (
          <p className="no-result">No threads yet. Join communities or follow people!</p>
        ) : (
          result.posts.map((post: any) => (
            <ThreadCard
              key={post._id}
              id={post._id}
              currentUserId={user?.id ?? ""}
              parentId={post.parentId}
              comments={post.children ?? []}
              createdAt={post.createdAt}
              community={post.community ?? null}
              author={post.author}
              content={post.text}
              images={post.images ?? []}
            />
          ))
        )}
      </section>
    </>
  );
}