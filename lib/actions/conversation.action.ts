"use server";

import { Types } from "mongoose";
import { ConnectedToDB } from "@/lib/mongoose";
import Conversation from "@/lib/models/conversation.model";
import User from "@/lib/models/user.model";

export interface ConversationParticipant {
  _id: Types.ObjectId;
  id: string;
  name: string;
  username: string;
  image: string;
}

export interface ConversationWithParticipant {
  _id: string;
  lastMessage: string;
  lastMessageAt: string;
  otherUser: ConversationParticipant;
}

/**
 * Find or create a conversation between two users (by their Clerk IDs).
 * Returns the conversation _id.
 */
export async function getOrCreateConversation(
  currentClerkId: string,
  otherClerkId: string
): Promise<string> {
  await ConnectedToDB();

  const [currentUser, otherUser] = await Promise.all([
    User.findOne({ id: currentClerkId }, { _id: 1 }),
    User.findOne({ id: otherClerkId }, { _id: 1 }),
  ]);

  if (!currentUser || !otherUser) {
    throw new Error("One or both users not found");
  }

  // Look for an existing conversation that has EXACTLY these two participants
  let conversation = await Conversation.findOne({
    participants: { $all: [currentUser._id, otherUser._id], $size: 2 },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [currentUser._id, otherUser._id],
    });
  }

  return conversation._id.toString();
}

/**
 * Fetch all conversations for the given Clerk user ID,
 * returning only the "other" participant's info so the Messages
 * page can render a list of people the user has talked to.
 */

type PopulatedConversation = {
  _id: Types.ObjectId;
  lastMessage: string;
  lastMessageAt: Date;
  participants: ConversationParticipant[];
};


export async function fetchUserConversations(
  clerkUserId: string
): Promise<ConversationWithParticipant[]> {
  await ConnectedToDB();

  const me = await User.findOne({ id: clerkUserId }, { _id: 1 });
  if (!me) return [];

  // 2. Cast the entire result as an array of PopulatedConversation
  const conversations = (await Conversation.find({
    participants: me._id,
  })
    .sort({ lastMessageAt: -1 })
    .populate({ // 3. Remove the <{ participants: ... }> generic from here
      path: "participants",
      model: User,
      select: "_id id name username image",
    })
    .lean()) as PopulatedConversation[];

  return conversations.map((convo) => {
    const other = convo.participants.find(
      (p) => p._id.toString() !== me._id.toString()
    )!;

    return {
      _id: convo._id.toString(),
      // TypeScript now knows these properties exist!
      lastMessage: convo.lastMessage, 
      lastMessageAt: convo.lastMessageAt.toISOString(),
      otherUser: other,
    };
  });
}

/**
 * Update the lastMessage / lastMessageAt on a conversation.
 * Call this every time a new WebSocket message is saved.
 */
export async function updateConversationLastMessage(
  conversationId: string,
  message: string
): Promise<void> {
  await ConnectedToDB();

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: message,
    lastMessageAt: new Date(),
  });
}