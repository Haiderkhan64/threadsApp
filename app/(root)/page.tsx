// "use client"
import ThreadCard from "@/components/carde/ThreadCard";
import { fetchPost } from "@/lib/actions/thread.action";
import { currentUser } from "@clerk/nextjs";

export default async function Home() {
  let page = "page's";
  const result = await fetchPost();
  const User = await currentUser();
  return (
    <>
      <h1 className="head-text text-left">Home</h1>
      <section className="mt-9 flex flex-col gap-10">
        {result.posts.length === 0 ? (
          <h1 className="No-result">No Thread Found</h1>
        ) : (
          result.posts.map((post) => (
            <ThreadCard
              key={post._id}
              id={post._id}
              currentUserId={User?.id || ""}
              parenId={post.parentId}
              comments={post.children}
              createdAt={post.createdAt}
              community={post.community}
              author={post.author}
              content={post.text}
            />
          ))
        )}
      </section>
    </>
  );
}
