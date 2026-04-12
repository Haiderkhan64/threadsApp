"use server";

import { revalidatePath } from "next/cache";
import { FilterQuery, SortOrder, Types } from "mongoose";

import { ConnectedToDB } from "@/lib/mongoose";
import Community from "@/lib/models/community.model";
import User from "@/lib/models/user.model";
import Thread from "@/lib/models/thread.model";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface PopulatedUser {
  _id: string; // ✅ string after serialization
  id: string;
  name: string;
  username: string;
  image: string;
  bio: string;
  onboarded: boolean;
  threads: string[]; // ✅ string[]
  communities: PopulatedCommunityRef[];
}

export interface PopulatedCommunityRef {
  _id: string;
  id: string;
  name: string;
  image: string;
}

export interface UserListItem {
  id: string;
  name: string;
  username: string;
  image: string;
}

export interface FetchUsersResult {
  users: UserListItem[];
  isNext: boolean;
}

export interface ActivityReply {
  _id: string;
  text: string;
  parentId: string;
  author: {
    _id: string;
    name: string;
    image: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Next.js Server Components cannot serialize ObjectId / Date values.
 * JSON round-trip is the safest way to strip all Mongoose-specific types.
 */
function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

// ─── fetchUser ────────────────────────────────────────────────────────────────

export async function fetchUser(userId: string): Promise<PopulatedUser | null> {
  try {
    await ConnectedToDB();

    const doc = await User.findOne({ id: userId })
      .populate({
        path: "communities",
        model: Community,
        select: "_id id name image",
      })
      .lean();

    if (!doc) return null;
    return serialize<PopulatedUser>(doc);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch user: ${message}`);
  }
}

// ─── updateUser ───────────────────────────────────────────────────────────────

export interface UpdateUserParams {
  userId: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}

export async function updateUser({
  userId,
  bio,
  name,
  path,
  username,
  image,
}: UpdateUserParams): Promise<void> {
  try {
    await ConnectedToDB();

    await User.findOneAndUpdate(
      { id: userId },
      {
        username: username.toLowerCase(),
        name,
        bio,
        image,
        onboarded: true,
      },
      { upsert: true }
    );

    if (path === "/profile/edit") {
      revalidatePath(path);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update user: ${message}`);
  }
}

// ─── fetchUserPosts ───────────────────────────────────────────────────────────

export interface PopulatedUserWithThreads extends Omit<PopulatedUser, "threads"> {
  threads: PopulatedUserThread[];
}

export interface PopulatedUserThread {
  _id: string;
  text: string;
  parentId: string | null;
  createdAt: string;
  community: PopulatedCommunityRef | null;
  children: {
    _id: string;
    text: string;
    author: {
      id: string;
      name: string;
      image: string;
    };
  }[];
}

export async function fetchUserPosts(
  userId: string
): Promise<PopulatedUserWithThreads | null> {
  try {
    await ConnectedToDB();

    const doc = await User.findOne({ id: userId })
      .populate({
        path: "threads",
        model: Thread,
        populate: [
          {
            path: "community",
            model: Community,
            select: "_id id name image",
          },
          {
            path: "children",
            model: Thread,
            populate: {
              path: "author",
              model: User,
              select: "_id id name image",
            },
          },
        ],
      })
      .lean();

    if (!doc) return null;
    return serialize<PopulatedUserWithThreads>(doc);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch user posts: ${message}`);
  }
}

// ─── fetchUsers ───────────────────────────────────────────────────────────────

export interface FetchUsersParams {
  userId: string;
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: SortOrder;
}

export async function fetchUsers({
  userId,
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = "desc",
}: FetchUsersParams): Promise<FetchUsersResult> {
  try {
    await ConnectedToDB();

    const skipAmount = (pageNumber - 1) * pageSize;

    const query: FilterQuery<typeof User> = {
      id: { $ne: userId },
    };

    if (searchString.trim()) {
      const regex = new RegExp(searchString.trim(), "i");
      query.$or = [
        { username: { $regex: regex } },
        { name: { $regex: regex } },
      ];
    }

    const [totalCount, rawUsers] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort({ createdAt: sortBy })
        .skip(skipAmount)
        .limit(pageSize)
        .select("_id id name username image")
        .lean()
        .exec(),
    ]);

    const users = serialize<UserListItem[]>(rawUsers);

    return {
      users,
      isNext: totalCount > skipAmount + users.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch users: ${message}`);
  }
}

// ─── fetchActivities ──────────────────────────────────────────────────────────

export async function fetchActivities(
  userId: string // MongoDB _id as string  e.g. "65f3a..."
): Promise<ActivityReply[]> {
  try {
    await ConnectedToDB();

    // Guard: only convert to ObjectId if it looks like one
    let authorObjectId: Types.ObjectId;
    try {
      authorObjectId = new Types.ObjectId(userId);
    } catch {
      throw new Error(`fetchActivities: invalid userId "${userId}"`);
    }

    const replies = await Thread.aggregate([
      { $match: { author: authorObjectId } },
      { $unwind: "$children" },
      {
        $lookup: {
          from: "threads",
          localField: "children",
          foreignField: "_id",
          as: "childThread",
        },
      },
      { $unwind: "$childThread" },
      { $match: { "childThread.author": { $ne: authorObjectId } } },
      {
        $lookup: {
          from: "users",
          localField: "childThread.author",
          foreignField: "_id",
          as: "childThread.author",
        },
      },
      { $unwind: "$childThread.author" },
      { $replaceRoot: { newRoot: "$childThread" } },
      {
        $project: {
          _id: 1,
          text: 1,
          parentId: 1,
          "author._id": 1,
          "author.name": 1,
          "author.image": 1,
        },
      },
    ]);

    return serialize<ActivityReply[]>(replies);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch activities: ${message}`);
  }
}