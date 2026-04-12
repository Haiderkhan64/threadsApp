import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { fetchUser } from "@/lib/actions/user.actions";
import { fetchCommunities } from "@/lib/actions/community.action";
import PostThread from "@/components/forms/PostThread";

export default async function CreateThreadPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const { communities } = await fetchCommunities({
    currentClerkId: user.id,
    pageSize: 20,
  });

  const joinedCommunities = communities
    .filter((c: any) => c.isJoined)
    .map((c: any) => ({
      _id: c._id.toString(), 
      name: c.name,
      username: c.username,
      image: c.image,
    }));

  return (
    <>
      <h1 className="head-text">Create Thread</h1>
      <PostThread
        userId={user.id}
        userImage={user.imageUrl}
        userName={userInfo.name}
        joinedCommunities={joinedCommunities}
      />
    </>
  );
}