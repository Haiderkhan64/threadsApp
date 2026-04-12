import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { fetchUser } from "@/lib/actions/user.actions";
import { fetchUserConversations } from "@/lib/actions/conversation.action";
import ConversationCard from "@/components/carde/ConversationCard";

export const metadata: Metadata = {
  title: "Messages · Thread",
  description: "Your conversations on Thread.",
};

export default async function MessagesPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const conversations = await fetchUserConversations(user.id);

  return (
    <section className="flex min-h-screen flex-col">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-dark-1/80 px-0 pb-4 pt-1 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-light-1 tracking-tight">
              Messages
            </h1>
            <p className="text-[13px] text-gray-1 mt-0.5">
              {conversations.length > 0
                ? `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`
                : "Start a new conversation"}
            </p>
          </div>
          {/* New message button */}
          <Link
            href="/search"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500/10 text-primary-500 transition-colors hover:bg-primary-500/20"
            title="New message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </Link>
        </div>

        {/* Search bar */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-dark-3 px-3.5 py-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-1 shrink-0">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            placeholder="Search messages…"
            className="flex-1 bg-transparent text-[14px] text-light-1 placeholder-gray-1 outline-none"
          />
        </div>
      </div>

      {/* ── List ── */}
      {conversations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-dark-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-1">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <p className="text-[16px] font-semibold text-light-1">No messages yet</p>
            <p className="mt-1 text-[13px] text-gray-1 max-w-[240px] mx-auto leading-relaxed">
              Visit someone&apos;s profile and tap{" "}
              <strong className="text-light-3">Message</strong> to start a conversation.
            </p>
          </div>
          <Link
            href="/search"
            className="mt-2 rounded-xl bg-primary-500 px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Find people
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col" role="list">
          {/* Section label */}
          <li className="px-1 pb-1 pt-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-1">
              Recent
            </span>
          </li>
          {conversations.map((convo) => (
            <li key={convo._id}>
              <ConversationCard conversation={convo} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


