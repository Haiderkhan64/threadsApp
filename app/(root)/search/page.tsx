// app/(root)/search/page.tsx

import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

import SearchInput from "@/components/shared/SearchInput";
import { fetchUser, fetchUsers } from "@/lib/actions/user.actions";
import type { FetchUsersResult } from "@/lib/actions/user.actions";
import UserCard from "@/components/carde/UserCard";


// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchPageProps {
  searchParams: { q?: string; page?: string };
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Search · Thread",
  description: "Find and connect with other users on Thread.",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Both fetches are independent — run in parallel
  const [userInfo, result] = await Promise.all([
    fetchUser(user.id),
    fetchUsers({
      userId: user.id,
      searchString: searchParams.q ?? "",
      pageNumber: Number(searchParams.page ?? 1),
      pageSize: 25,
      sortBy: "desc",
    }),
  ]);

  if (!userInfo?.onboarded) redirect("/onboarding");

  return (
    <section className="flex flex-col gap-10">
      <h1 className="head-text text-light-1">Search</h1>

      {/*
        SearchInput uses useRouter — it must be a Client Component.
        Wrapping in Suspense is required when a client component
        calls useSearchParams() inside a Server Component tree.
      */}
      <Suspense>
        <SearchInput />
      </Suspense>

      <UserResults users={result.users} searchQuery={searchParams.q} />
    </section>
  );
}

// ─── Results sub-component ────────────────────────────────────────────────────

interface UserResultsProps {
  users: FetchUsersResult["users"];
  searchQuery?: string;
}

function UserResults({ users, searchQuery }: UserResultsProps) {
  if (users.length === 0) {
    return (
      <p className="no-result">
        {searchQuery
          ? `No users found for "${searchQuery}"`
          : "No users found"}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-9" role="list">
      {users.map((person) => (
        <li key={person.id}>
          <UserCard
            id={person.id}
            name={person.name}
            userName={person.username}
            imgUrl={person.image}
            personType="User"
          />
        </li>
      ))}
    </ul>
  );
}