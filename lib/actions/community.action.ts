"use server";

import { revalidatePath } from "next/cache";
import { FilterQuery, SortOrder, Types } from "mongoose";
import { ConnectedToDB } from "@/lib/mongoose";
import Community from "@/lib/models/community.model";
import Thread from "@/lib/models/thread.model";
import User from "@/lib/models/user.model";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommunityListItem {
  _id: string;
  username: string;
  name: string;
  image: string;
  bio: string;
  memberCount: number;
  isJoined: boolean;
}

export interface CommunityDetail {
  _id: string;
  username: string;
  name: string;
  image: string;
  bio: string;
  createdAt: string;
  createdBy: {
    _id: string;
    id: string;
    name: string;
    username: string;
    image: string;
  };
  members: {
    _id: string;
    id: string;
    name: string;
    username: string;
    image: string;
  }[];
  threads: string[];
}

// ─── Create Community ─────────────────────────────────────────────────────────

interface CreateCommunityParams {
  name: string;
  username: string;
  bio: string;
  image: string;
  creatorClerkId: string; // Clerk user ID of whoever is creating
}

export async function createCommunity({
  name,
  username,
  bio,
  image,
  creatorClerkId,
}: CreateCommunityParams): Promise<{ success: boolean; communityId?: string; error?: string }> {
  try {
    await ConnectedToDB();

    const creator = await User.findOne({ id: creatorClerkId }, { _id: 1 });
    if (!creator) return { success: false, error: "User not found" };

    // Username must be unique (case-insensitive)
    const slug = username.toLowerCase().trim();
    const existing = await Community.findOne({ username: slug });
    if (existing) return { success: false, error: "Community name already taken" };

    const community = await Community.create({
      name: name.trim(),
      username: slug,
      bio: bio.trim(),
      image,
      createdBy: creator._id,
      members: [creator._id], // creator is automatically a member
    });

    // Add community to creator's list
    await User.findByIdAndUpdate(creator._id, {
      $push: { communities: community._id },
    });

    return { success: true, communityId: community._id.toString() };
  } catch (err: any) {
    console.error("[createCommunity]", err);
    return { success: false, error: err.message ?? "Unknown error" };
  }
}

// ─── Fetch Community Details ──────────────────────────────────────────────────

export async function fetchCommunityDetails(
  username: string
): Promise<CommunityDetail | null> {
  try {
    await ConnectedToDB();

    const doc = await Community.findOne({ username: username.toLowerCase() })
      .populate({ path: "createdBy", model: User, select: "_id id name username image" })
      .populate({ path: "members", model: User, select: "_id id name username image" })
      .lean();

    if (!doc) return null;
    return serialize<CommunityDetail>(doc);
  } catch (err) {
    console.error("[fetchCommunityDetails]", err);
    throw err;
  }
}

export async function fetchCommunityById(
  communityId: string
): Promise<CommunityDetail | null> {
  try {
    await ConnectedToDB();

    const doc = await Community.findById(communityId)
      .populate({ path: "createdBy", model: User, select: "_id id name username image" })
      .populate({ path: "members", model: User, select: "_id id name username image" })
      .lean();

    if (!doc) return null;
    return serialize<CommunityDetail>(doc);
  } catch (err) {
    console.error("[fetchCommunityById]", err);
    throw err;
  }
}

// ─── Fetch Communities List ───────────────────────────────────────────────────

interface FetchCommunitiesParams {
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: SortOrder;
  currentClerkId?: string; // so we can mark isJoined
}

export async function fetchCommunities({
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = "desc",
  currentClerkId,
}: FetchCommunitiesParams): Promise<{ communities: CommunityListItem[]; isNext: boolean }> {
  try {
    await ConnectedToDB();

    // Resolve current user's _id for the isJoined check
    let currentUserObjectId: Types.ObjectId | null = null;
    if (currentClerkId) {
      const u = await User.findOne({ id: currentClerkId }, { _id: 1 });
      if (u) currentUserObjectId = u._id;
    }

    const query: FilterQuery<typeof Community> = {};
    if (searchString.trim()) {
      const regex = new RegExp(searchString.trim(), "i");
      query.$or = [{ name: { $regex: regex } }, { username: { $regex: regex } }];
    }

    const skip = (pageNumber - 1) * pageSize;

    const [total, docs] = await Promise.all([
      Community.countDocuments(query),
      Community.find(query)
        .sort({ createdAt: sortBy })
        .skip(skip)
        .limit(pageSize)
        .select("_id username name image bio members")
        .lean(),
    ]);

    const communities: CommunityListItem[] = docs.map((c: any) => ({
      _id: c._id.toString(),
      username: c.username,
      name: c.name,
      image: c.image,
      bio: c.bio,
      memberCount: c.members?.length ?? 0,
      isJoined: currentUserObjectId
        ? c.members?.some((m: any) => m.toString() === currentUserObjectId!.toString())
        : false,
    }));

    return { communities, isNext: total > skip + docs.length };
  } catch (err) {
    console.error("[fetchCommunities]", err);
    throw err;
  }
}

// ─── Join Community ───────────────────────────────────────────────────────────

export async function joinCommunity(
  communityId: string,
  clerkUserId: string,
  path: string
): Promise<void> {
  await ConnectedToDB();

  const [community, user] = await Promise.all([
    Community.findById(communityId),
    User.findOne({ id: clerkUserId }),
  ]);

  if (!community) throw new Error("Community not found");
  if (!user) throw new Error("User not found");

  const alreadyMember = community.members.some((m: any) =>
    m.equals(user._id)
  );

  if (!alreadyMember) {
    await Promise.all([
      Community.findByIdAndUpdate(communityId, {
        $addToSet: { members: user._id },
      }),
      User.findByIdAndUpdate(user._id, {
        $addToSet: { communities: community._id },
      }),
    ]);
  }

  revalidatePath(path);
}

// ─── Leave Community ──────────────────────────────────────────────────────────

export async function leaveCommunity(
  communityId: string,
  clerkUserId: string,
  path: string
): Promise<void> {
  await ConnectedToDB();

  const [community, user] = await Promise.all([
    Community.findById(communityId),
    User.findOne({ id: clerkUserId }),
  ]);

  if (!community) throw new Error("Community not found");
  if (!user) throw new Error("User not found");

  // Creator cannot leave their own community
  if (community.createdBy.equals(user._id)) {
    throw new Error("Community creator cannot leave. Delete the community instead.");
  }

  await Promise.all([
    Community.findByIdAndUpdate(communityId, {
      $pull: { members: user._id },
    }),
    User.findByIdAndUpdate(user._id, {
      $pull: { communities: community._id },
    }),
  ]);

  revalidatePath(path);
}

// ─── Membership Check ─────────────────────────────────────────────────────────

export async function isCommunityMember(
  communityId: string,
  clerkUserId: string
): Promise<boolean> {
  await ConnectedToDB();

  const user = await User.findOne({ id: clerkUserId }, { _id: 1 });
  if (!user) return false;

  const community = await Community.findById(communityId, { members: 1 });
  if (!community) return false;

  return community.members.some((m: any) => m.equals(user._id));
}

// ─── Delete Community ─────────────────────────────────────────────────────────

export async function deleteCommunity(
  communityId: string,
  clerkUserId: string,
  path: string
): Promise<void> {
  await ConnectedToDB();

  const [community, user] = await Promise.all([
    Community.findById(communityId),
    User.findOne({ id: clerkUserId }, { _id: 1 }),
  ]);

  if (!community) throw new Error("Community not found");
  if (!user) throw new Error("User not found");

  if (!community.createdBy.equals(user._id)) {
    throw new Error("Only the creator can delete this community");
  }

  // Remove community from all members
  await User.updateMany(
    { communities: community._id },
    { $pull: { communities: community._id } }
  );

  // Delete all threads in this community
  await Thread.deleteMany({ community: community._id });

  await Community.findByIdAndDelete(communityId);

  revalidatePath(path);
}

// ─── Fetch Community Posts (members only) ────────────────────────────────────

export async function fetchCommunityPosts(communityId: string) {
  try {
    await ConnectedToDB();

    const community = await Community.findById(communityId)
      .populate({
        path: "threads",
        model: Thread,
        match: { parentId: { $in: [null, undefined] } },
        populate: [
          { path: "author", model: User, select: "name image id" },
          {
            path: "children",
            model: Thread,
            populate: { path: "author", model: User, select: "image _id" },
          },
        ],
      })
      .lean();

    if (!community) return null;
    return serialize(community);
  } catch (err) {
    console.error("[fetchCommunityPosts]", err);
    throw err;
  }
}

// ─── Update Community ─────────────────────────────────────────────────────────

interface UpdateCommunityParams {
  communityId: string;
  name: string;
  bio: string;
  image: string;
  clerkUserId: string;
  path: string;
}

export async function updateCommunity({
  communityId,
  name,
  bio,
  image,
  clerkUserId,
  path,
}: UpdateCommunityParams): Promise<void> {
  await ConnectedToDB();

  const [community, user] = await Promise.all([
    Community.findById(communityId),
    User.findOne({ id: clerkUserId }, { _id: 1 }),
  ]);

  if (!community) throw new Error("Community not found");
  if (!user) throw new Error("User not found");
  if (!community.createdBy.equals(user._id)) {
    throw new Error("Only the creator can edit this community");
  }

  await Community.findByIdAndUpdate(communityId, {
    name: name.trim(),
    bio: bio.trim(),
    image,
  });

  revalidatePath(path);
}