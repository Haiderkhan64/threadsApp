import { currentUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { fetchCommunities } from "@/lib/actions/community.action";
import { fetchUsers } from "@/lib/actions/user.actions";

async function RightSidebar() {
  const user = await currentUser();
  if (!user) return null;

  // ── Isolate each fetch so one failure doesn't crash the whole layout ───────
  let similarMinds: Awaited<ReturnType<typeof fetchUsers>> = {
    users: [],
    isNext: false,
  };
  let suggestedCommunities: Awaited<ReturnType<typeof fetchCommunities>> = {
    communities: [],
    isNext: false,
  };

  try {
    similarMinds = await fetchUsers({ userId: user.id, pageSize: 4 });
  } catch (err) {
    // Real error will now appear in your terminal
    console.error("[RightSidebar] fetchUsers failed:", err);
  }

  try {
    suggestedCommunities = await fetchCommunities({ pageSize: 4 });
  } catch (err) {
    console.error("[RightSidebar] fetchCommunities failed:", err);
  }

  return (
    <section className="custom-scrollbar sticky right-0 top-0 z-20 flex h-screen w-60 flex-col justify-between gap-10 overflow-auto border-l border-l-dark-4 bg-dark-2 px-6 pb-6 pt-28 max-xl:hidden">

      {/* Suggested Communities */}
      <div className="flex flex-col gap-6">
        <h3 className="text-heading4-medium text-light-1">
          Suggested Communities
        </h3>

        <div className="flex flex-col gap-5">
          {suggestedCommunities.communities.length > 0 ? (
            suggestedCommunities.communities.map((community) => (
              <Link
                key={community.username}
                href={`/communities/${community.username}`}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-dark-3"
              >
                <div className="relative h-9 w-9 shrink-0">
                  <Image
                    src={community.image || "/assets/community.svg"}
                    fill
                    sizes="36px"
                    alt={community.name ?? "Community"}
                    className="rounded-full object-cover"
                  />
                </div>
                <div className="flex min-w-0 flex-col">
                  <p className="truncate text-small-semibold text-light-1">
                    {community.name}
                  </p>
                  <p className="truncate text-subtle-medium text-gray-1">
                    @{community.username}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-base-regular text-light-3">No communities yet</p>
          )}
        </div>
      </div>

      {/* Similar Minds */}
      <div className="flex flex-col gap-6">
        <h3 className="text-heading4-medium text-light-1">Similar Minds</h3>

        <div className="flex flex-col gap-5">
          {similarMinds.users.length > 0 ? (
            similarMinds.users.map((person) => (
              <Link
                key={person.id}
                href={`/profile/${person.id}`}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-dark-3"
              >
                <div className="relative h-9 w-9 shrink-0">
                  <Image
                    src={person.image || "/assets/user.svg"}
                    fill
                    sizes="36px"
                    alt={person.name ?? "User"}
                    className="rounded-full object-cover"
                  />
                </div>
                <div className="flex min-w-0 flex-col">
                  <p className="truncate text-small-semibold text-light-1">
                    {person.name}
                  </p>
                  <p className="truncate text-subtle-medium text-gray-1">
                    @{person.username}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-base-regular text-light-3">No users yet</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-subtle-medium text-gray-1">
        © {new Date().getFullYear()} Threads
      </p>
    </section>
  );
}

export default RightSidebar;