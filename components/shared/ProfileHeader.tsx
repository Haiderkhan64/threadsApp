import Image from "next/image";
interface Params {
  accountId: string;
  authId: string;
  image: string;
  name: string;
  userName: string;
  bio: string;
}

const ProfileHeader = ({
  accountId,
  authId,
  image,
  name,
  userName,
  bio,
}: Params) => {
  return (
    <div className="flex w-full flex-col justify-start">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-20 object-cover">
            <Image
              alt="Profile"
              src={image}
              width={50}
              height={50}
              className="rounded-full object-cover shadow-2xl"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-left text-heading3-bold text-light-1">
              {name}
            </h2>

            <p className="text-base-medium text-gray-1">@{userName}</p>
          </div>
        </div>
      </div>
      {/* todo : Community */}
      <p className="mt-6 max-w-lg text-base-regular text-light-2">{bio}</p>
      <div className="mt-12 h-0.5 w-full bg-dark-3" />
    </div>
  );
};

export default ProfileHeader;
