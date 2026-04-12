"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { ConnectedToDB } from "@/lib/mongoose";
import User from "@/lib/models/user.model";
import Thread from "@/lib/models/thread.model";
import Community from "@/lib/models/community.model";

function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

export async function fetchPost(
  pageNumber = 1,
  pageSize = 20,
  clerkUserId?: string
) {
  await ConnectedToDB();

  const skip = (pageNumber - 1) * pageSize;

  let joinedCommunityIds: Types.ObjectId[] = [];
  if (clerkUserId) {
    const user = await User.findOne({ id: clerkUserId }, { communities: 1 });
    if (user?.communities?.length) {
      joinedCommunityIds = user.communities;
    }
  }

  const visibilityFilter =
    joinedCommunityIds.length > 0
      ? {
          $or: [
            { community: null },
            { community: { $in: joinedCommunityIds } },
          ],
        }
      : { community: null };

  const matchStage = {
    parentId: { $in: [null, undefined] },
    ...visibilityFilter,
  };

  const [total, posts] = await Promise.all([
    Thread.countDocuments(matchStage),
    Thread.find(matchStage)
      .sort({ createdAt: "desc" })
      .skip(skip)
      .limit(pageSize)
      .populate({ path: "author", model: User })
      .populate({ path: "community", model: Community })
      .populate({
        path: "children",
        populate: {
          path: "author",
          model: User,
          select: "_id name parentId image",
        },
      })
      .lean(),
  ]);

  return { posts: serialize(posts), isNext: total > skip + posts.length };
}

// ── Create Thread ─────────────────────────────────────────────────────────────

export async function createThread({
  text,
  author,
  communityId,
  path,
  images = [],
}: {
  text: string;
  author: string;
  communityId: string | null;
  path: string;
  images?: string[]; // UploadThing URLs
}) {
  try {
    await ConnectedToDB();

    const authorDoc = await User.findOne({ id: author });
    if (!authorDoc) throw new Error("Author not found");

    let communityObjectId: Types.ObjectId | null = null;

    if (communityId) {
      const community = await Community.findById(communityId);
      if (!community) throw new Error("Community not found");

      const isMember = await Community.exists({
        _id: community._id,
        members: authorDoc._id,
      });

      if (!isMember) throw new Error("You must be a member to post here");

      communityObjectId = community._id as Types.ObjectId;
    }

    const thread = await Thread.create({
      text,
      author: authorDoc._id,
      community: communityObjectId,
      images: images.filter(Boolean), // only valid URLs
    });

    await User.findByIdAndUpdate(authorDoc._id, {
      $push: { threads: thread._id },
    });

    if (communityObjectId) {
      await Community.findByIdAndUpdate(communityObjectId, {
        $push: { threads: thread._id },
      });
    }

    revalidatePath(path);
  } catch (err: any) {
    throw new Error(`Failed to create thread: ${err.message}`);
  }
}

// ── Fetch Single Thread ───────────────────────────────────────────────────────

export async function fetchThread(threadId: string) {
  await ConnectedToDB();

  try {
    const thread = await Thread.findById(threadId)
      .populate({ path: "author", model: User, select: "_id id name image" })
      .populate({
        path: "community",
        model: Community,
        select: "_id id name image username",
      })
      .populate({
        path: "children",
        populate: [
          {
            path: "author",
            model: User,
            select: "_id id name parentId image",
          },
          {
            path: "children",
            model: Thread,
            populate: {
              path: "author",
              model: User,
              select: "_id id name parentId image",
            },
          },
        ],
      })
      .exec();

    if (!thread) return null;
    return serialize(thread);
  } catch (err) {
    console.error("Error fetching thread:", err);
    throw new Error("Unable to fetch thread");
  }
}

// ── Add Comment ───────────────────────────────────────────────────────────────

export async function addCommentToThread(
  threadId: string,
  commentText: string,
  clerkUserId: string,
  path: string
) {
  await ConnectedToDB();

  try {
    const user = await User.findOne({ id: clerkUserId });
    if (!user) throw new Error("User not found");

    const parent = await Thread.findById(threadId);
    if (!parent) throw new Error("Thread not found");

    const comment = await Thread.create({
      text: commentText,
      author: user._id,
      parentId: threadId,
      community: parent.community ?? null,
    });

    parent.children.push(comment._id);
    await parent.save();

    revalidatePath(path);
  } catch (err: any) {
    throw new Error(`Unable to add comment: ${err.message}`);
  }
}

// ── Delete Thread ─────────────────────────────────────────────────────────────

async function collectDescendants(threadId: string): Promise<any[]> {
  const children = await Thread.find({ parentId: threadId });
  const descendants: any[] = [];
  for (const child of children) {
    const nested = await collectDescendants(child._id.toString());
    descendants.push(child, ...nested);
  }
  return descendants;
}

export async function deleteThread(id: string, path: string): Promise<void> {
  try {
    await ConnectedToDB();

    const main = await Thread.findById(id).populate("author community");
    if (!main) throw new Error("Thread not found");

    const descendants = await collectDescendants(id);
    const allIds = [id, ...descendants.map((t) => t._id)];

    const authorIds = new Set(
      [
        main.author?._id?.toString(),
        ...descendants.map((t) => t.author?._id?.toString()),
      ].filter(Boolean)
    );
    const communityIds = new Set(
      [
        main.community?._id?.toString(),
        ...descendants.map((t) => t.community?._id?.toString()),
      ].filter(Boolean)
    );

    await Thread.deleteMany({ _id: { $in: allIds } });

    await User.updateMany(
      { _id: { $in: Array.from(authorIds) } },
      { $pull: { threads: { $in: allIds } } }
    );

    await Community.updateMany(
      { _id: { $in: Array.from(communityIds) } },
      { $pull: { threads: { $in: allIds } } }
    );

    revalidatePath(path);
  } catch (err: any) {
    throw new Error(`Failed to delete thread: ${err.message}`);
  }
}