import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

import { fetchUser } from "@/lib/actions/user.actions";
import { fetchCommunities } from "@/lib/actions/community.action";
import Pagination from "@/components/shared/Pagination";
import CommunityCard from "@/components/carde/CommunityCard";
import SearchInput from "@/components/shared/SearchInput";

export const metadata: Metadata = {
  title: "Communities · Thread",
  description: "Discover communities on Thread.",
};

interface Props {
  searchParams: { q?: string; page?: string };
}

export default async function CommunitiesPage({ searchParams }: Props) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const result = await fetchCommunities({
    searchString: searchParams.q ?? "",
    pageNumber: searchParams.page ? +searchParams.page : 1,
    pageSize: 20,
    sortBy: "desc",
    currentClerkId: user.id,
  });

  return (
    <section className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="head-text">Communities</h1>
        <Link
          href="/communities/create"
          className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-small-semibold text-light-1 hover:bg-primary-500/80 transition-colors"
        >
          <Image src="/assets/community.svg" alt="" width={16} height={16} />
          Create
        </Link>
      </div>

      {/* Search */}
      <Suspense>
        <SearchInput />
      </Suspense>

      {/* Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {result.communities.length === 0 ? (
          <p className="no-result col-span-2">
            {searchParams.q
              ? `No communities found for "${searchParams.q}"`
              : "No communities yet. Be the first to create one!"}
          </p>
        ) : (
          result.communities.map((community) => (
            <CommunityCard key={community._id} community={community} />
          ))
        )}
      </section>

      <Pagination
        path="communities"
        pageNumber={searchParams.page ? +searchParams.page : 1}
        isNext={result.isNext}
      />
    </section>
  );
}