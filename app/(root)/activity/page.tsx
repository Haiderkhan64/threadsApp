import { fetchActivities, fetchUser } from "@/lib/actions/user.actions";
import { currentUser } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const page = async () => {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const activities: any[] = await fetchActivities(userInfo._id);

  return (
    <section className="flex flex-col gap-0">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="head-text text-light-1">Activity</h1>
        <p className="mt-1 text-[13px] text-gray-1">
          {activities.length > 0
            ? `${activities.length} notification${activities.length !== 1 ? "s" : ""}`
            : "You're all caught up"}
        </p>
      </div>

      {activities.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dark-4 bg-dark-2 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-dark-3">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5C5C7B"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div>
            <p className="text-base-semibold text-light-1">No activity yet</p>
            <p className="mt-1 max-w-[220px] text-[13px] leading-relaxed text-gray-1">
              When someone replies to your threads, it'll show up here.
            </p>
          </div>
        </div>
      ) : (
        /* ── Activity list ── */
        <div className="flex flex-col gap-2">
          {activities.map((activity: any, index: number) => (
            <Link
              key={activity._id}
              href={`/thread/${activity.parentId}`}
              className="group relative flex items-start gap-3.5 rounded-2xl border border-transparent bg-dark-2 px-4 py-4 transition-all duration-200 hover:border-dark-4 hover:bg-dark-3 active:scale-[0.99]"
            >
              {/* Unread dot — treat first 3 as unread for demo */}
              {index < 3 && (
                <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-primary-500" />
              )}

              {/* Avatar with reply icon badge */}
              <div className="relative mt-0.5 shrink-0">
                <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-dark-4 ring-offset-1 ring-offset-dark-2 transition-all group-hover:ring-primary-500/40">
                  <Image
                    src={activity.author.image}
                    fill
                    sizes="40px"
                    alt={`${activity.author.name}'s avatar`}
                    className="object-cover"
                  />
                </div>
                {/* Badge */}
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 ring-2 ring-dark-2">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] leading-snug text-light-1">
                    <span className="font-semibold text-primary-500">
                      {activity.author.name}
                    </span>
                    <span className="ml-1 font-normal text-light-3">
                      replied to your thread
                    </span>
                  </p>
                  {activity.createdAt && (
                    <time
                      dateTime={activity.createdAt}
                      className="shrink-0 text-[11px] tabular-nums text-gray-1"
                    >
                      {timeAgo(activity.createdAt)}
                    </time>
                  )}
                </div>

                {/* Reply preview */}
                {activity.text && (
                  <p className="line-clamp-2 text-[13px] leading-relaxed text-light-4">
                    {activity.text}
                  </p>
                )}
              </div>

              {/* Chevron */}
              <svg
                className="mt-1 shrink-0 text-dark-4 transition-colors group-hover:text-gray-1"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

export default page;