import Image from "next/image";
import Link from "next/link";

interface Params {
  accountId: string;
  authUserId: string; // Clerk ID of the logged-in user
  image: string;
  name: string;
  userName: string;
  bio: string;
}

const ProfileHeader = ({
  accountId,
  authUserId,
  image,
  name,
  userName,
  bio,
}: Params) => {
  const isOwnProfile = accountId === authUserId;

  return (
    <div className="flex w-full flex-col justify-start">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative h-20 w-20">
            <Image
              alt={`${name}'s profile photo`}
              src={image}
              fill
              sizes="80px"
              className="rounded-full object-cover shadow-2xl"
            />
          </div>

          {/* Name + username */}
          <div className="flex flex-col">
            <h2 className="text-left text-heading3-bold text-light-1">
              {name}
            </h2>
            <p className="text-base-medium text-gray-1">@{userName}</p>
          </div>
        </div>

        {/* ── Action buttons (only visible when viewing someone else's profile) ── */}
        {!isOwnProfile && (
          <Link
            href={`/messages/${accountId}`}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-small-semibold text-light-1 transition-opacity hover:opacity-80"
          >
            <Image
              src="/assets/paper-plane.svg"
              alt=""
              width={16}
              height={16}
              className="invert brightness-0"
            />
            Message
          </Link>
        )}
      </div>

      {/* Bio */}
      <p className="mt-6 max-w-lg text-base-regular text-light-2">{bio}</p>

      <div className="mt-12 h-0.5 w-full bg-dark-3" />
    </div>
  );
};

export default ProfileHeader;