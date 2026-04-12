"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { ConnectedToDB } from "@/lib/mongoose";
import Community from "@/lib/models/community.model";
import User from "@/lib/models/user.model";

// ─── Join ─────────────────────────────────────────────────────────────────────

export async function joinCommunity(
  communityId: string,
  userId: string,
  path: string
): Promise<void> {
  await ConnectedToDB();

  const [community, user] = await Promise.all([
    Community.findOne({ id: communityId }),
    User.findOne({ id: userId }),
  ]);

  if (!community) throw new Error("Community not found");
  if (!user) throw new Error("User not found");

  // Update MongoDB
  const alreadyMember = community.members.some((m: any) => m.equals(user._id));
  if (!alreadyMember) {
    community.members.push(user._id);
    user.communities.push(community._id);
    await Promise.all([community.save(), user.save()]);
  }

  // Sync with Clerk — best-effort, non-fatal
  try {
    const memberships =
      await clerkClient.organizations.getOrganizationMembershipList({
        organizationId: communityId,
      });

    const list: any[] = Array.isArray(memberships)
      ? memberships
      : (memberships as any).data ?? [];

    const alreadyInClerk = list.some(
      (m: any) => m.publicUserData?.userId === userId
    );

    if (!alreadyInClerk) {
      await clerkClient.organizations.createOrganizationMembership({
        organizationId: communityId,
        userId,
        role: "basic_member",
      });
    }
  } catch (err: any) {
    console.error(
      "[joinCommunity] Clerk sync error (non-fatal):",
      err?.errors ?? err?.message ?? err
    );
  }

  revalidatePath(path);
}

// ─── Leave ────────────────────────────────────────────────────────────────────

export async function leaveCommunity(
  communityId: string,
  userId: string,
  path: string
): Promise<void> {
  await ConnectedToDB();

  const [community, user] = await Promise.all([
    Community.findOne({ id: communityId }),
    User.findOne({ id: userId }),
  ]);

  if (!community) throw new Error("Community not found");
  if (!user) throw new Error("User not found");

  // Update MongoDB
  await Promise.all([
    Community.updateOne(
      { _id: community._id },
      { $pull: { members: user._id } }
    ),
    User.updateOne(
      { _id: user._id },
      { $pull: { communities: community._id } }
    ),
  ]);

  // Sync with Clerk — best-effort, non-fatal
  try {
    await clerkClient.organizations.deleteOrganizationMembership({
      organizationId: communityId,
      userId,
    });
  } catch (err: any) {
    console.error(
      "[leaveCommunity] Clerk sync error (non-fatal):",
      err?.errors ?? err?.message ?? err
    );
  }

  revalidatePath(path);
}

// ─── Check membership ─────────────────────────────────────────────────────────

export async function isCommunityMember(
  communityId: string,
  userId: string
): Promise<boolean> {
  await ConnectedToDB();

  const [community, user] = await Promise.all([
    Community.findOne({ id: communityId }, { members: 1 }),
    User.findOne({ id: userId }, { _id: 1 }),
  ]);

  if (!community || !user) return false;

  return community.members.some((m: any) => m.equals(user._id));
}