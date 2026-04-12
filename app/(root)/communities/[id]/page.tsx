import Image from "next/image";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";

import { fetchUser } from "@/lib/actions/user.actions";
import {
  fetchCommunityDetails,
  isCommunityMember,
} from "@/lib/actions/community.action";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { communityTabs } from "@/constants";
import ThreadsTab from "@/components/shared/ThreadsTab";
import UserCard from "@/components/carde/UserCard";
import JoinLeaveButton from "@/components/carde/JoinLeaveButton";

interface Props {
  params: { id: string }; // id = community username (slug)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `c/${params.id} · Thread` };
}

export default async function CommunityPage({ params }: Props) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const [userInfo, community] = await Promise.all([
    fetchUser(user.id),
    fetchCommunityDetails(params.id), // lookup by username slug
  ]);

  if (!userInfo?.onboarded) redirect("/onboarding");
  if (!community) notFound();

  const memberStatus = await isCommunityMember(community._id, user.id);
  const isCreator = (community.createdBy as any)?.id === user.id;

  return (
    <section className="flex flex-col gap-0">
      {/* ── Banner ── */}
      <div className="relative w-full">
        <div className="h-36 w-full rounded-t-xl bg-gradient-to-br from-primary-500/50 via-dark-3 to-dark-4" />
        <div className="absolute -bottom-10 left-6">
          <div className="relative h-20 w-20 rounded-full ring-4 ring-dark-1">
            <Image
              src={community.image || "/assets/community.svg"}
              fill
              sizes="80px"
              alt={community.name}
              className="rounded-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* ── Meta ── */}
      <div className="mt-14 flex flex-col gap-3 px-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-heading3-bold text-light-1">
              {community.name}
            </h1>
            <p className="text-base-medium text-gray-1">
              c/{community.username}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Member count */}
            <div className="flex items-center gap-1.5 rounded-full bg-dark-3 px-3 py-1.5">
              <Image
                src="/assets/members.svg"
                alt=""
                width={14}
                height={14}
              />
              <span className="text-subtle-medium text-light-2">
                {community.members.length}{" "}
                {community.members.length === 1 ? "member" : "members"}
              </span>
            </div>

            {/* Join / Leave */}
            <JoinLeaveButton
              communityId={community._id}
              clerkUserId={user.id}
              initialIsMember={memberStatus}
              isCreator={isCreator}
            />

            {/* Edit — only creator */}
            {isCreator && (
              <Link
                href={`/communities/${community.username}/edit`}
                className="flex items-center gap-1.5 rounded-lg border border-light-4 px-4 py-2 text-small-semibold text-light-3 hover:border-primary-500 hover:text-light-1 transition-colors"
              >
                <Image src="/assets/edit.svg" alt="" width={14} height={14} />
                Edit
              </Link>
            )}
          </div>
        </div>

        {community.bio && (
          <p className="max-w-2xl text-base-regular text-light-3">
            {community.bio}
          </p>
        )}

        {/* Private notice for non-members */}
        {!memberStatus && !isCreator && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-dark-4 bg-dark-3 px-4 py-3">
            <Image src="/assets/heart-gray.svg" alt="" width={16} height={16} />
            <p className="text-small-regular text-light-3">
              Join this community to see and post threads.
            </p>
          </div>
        )}

        <div className="mt-4 h-px w-full bg-dark-4" />
      </div>

      {/* ── Tabs ── */}
      <div className="mt-4 px-4 sm:px-6">
        <Tabs defaultValue="threads" className="w-full">
          <TabsList className="tab">
            {communityTabs.map((tab) => (
              <TabsTrigger key={tab.label} value={tab.value} className="tab">
                <Image
                  src={tab.icon}
                  alt={tab.label}
                  width={22}
                  height={22}
                  className="object-contain"
                />
                <p className="max-sm:hidden">{tab.label}</p>
                {tab.label === "Threads" && (
                  <span className="ml-1 rounded-sm bg-light-4 px-2 py-0.5 text-tiny-medium text-light-2">
                    {community.threads.length}
                  </span>
                )}
                {tab.label === "Members" && (
                  <span className="ml-1 rounded-sm bg-light-4 px-2 py-0.5 text-tiny-medium text-light-2">
                    {community.members.length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Threads — gated to members */}
          <TabsContent value="threads" className="w-full text-light-1">
            {memberStatus || isCreator ? (
              <ThreadsTab
                currentUserId={user.id}
                accountId={community._id}
                accountType="Community"
              />
            ) : (
              <div className="mt-16 flex flex-col items-center gap-3 text-center">
                <p className="text-base-semibold text-light-2">
                  Members only
                </p>
                <p className="text-small-regular text-light-3">
                  Join the community to see posts.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Members — always visible */}
          <TabsContent value="members" className="mt-6 w-full text-light-1">
            <section className="flex flex-col gap-5">
              {community.members.length === 0 ? (
                <p className="no-result">No members yet</p>
              ) : (
                community.members.map((member: any) => (
                  <UserCard
                    key={member.id}
                    id={member.id}
                    name={member.name}
                    userName={member.username}
                    imgUrl={member.image}
                    personType="User"
                  />
                ))
              )}
            </section>
          </TabsContent>

          {/* Requests placeholder */}
          <TabsContent value="requests" className="mt-6 w-full text-light-1">
            <p className="no-result">No pending requests</p>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}