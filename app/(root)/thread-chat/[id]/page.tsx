import React from "react";
import ThreadChat from "@/components/forms/ThreadChat";
import { fetchUser } from "@/lib/actions/user.actions";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";
import Image from "next/image";

const Page = async ({ params }: { params: { id: string } }) => {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userInfo = await fetchUser(params.id); // the OTHER user
  const currentUserInfo = await fetchUser(user.id); // logged-in user

  if (!userInfo?.onboarded) redirect("/onboarding");

  const roomId = [user.id, params.id].sort().join("-");

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-4 mb-6 p-4 bg-dark-2 rounded-lg">
        <Image
          src={userInfo.image}
          alt={`${userInfo.name}'s profile picture`}
          width={55}
          height={55}
          className="rounded-full"
        />
        <div>
          <h2 className="text-xl font-bold">{userInfo.name}</h2>
          <h5 className="text-gray-400">@{userInfo.username}</h5>
        </div>
      </div>

      <ThreadChat
        roomId={roomId}
        currentUser={currentUserInfo.name}
        currentUserId={user.id}
        anotherUserId={userInfo.id}
      />
    </div>
  );
};

export default Page;
