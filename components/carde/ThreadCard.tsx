// "use client";
import { formatDateString } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

interface props {
  id: string;
  currentUserId: string;
  parenId: string | null;
  comments: {
    author: {
      image: string;
    };
  }[];
  createdAt: string;
  community: {
    id: string;
    name: string;
    image: string;
  } | null;
  author: {
    id: string;
    name: string;
    image: string;
  };
  content: string;
  isComment?: boolean;
}

const ThreadCard = ({
  id,
  currentUserId,
  parenId,
  comments,
  createdAt,
  community,
  author,
  content,
  isComment,
}: props) => {
  return (
    <article
      className={`flex flex-col rounded-xl ${
        isComment ? "px-0 xs:px-7" : " bg-dark-2 p-7"
      }`}>
      <div className="flex items-start justify-between">
        <div className="flex w-full flex-1 flex-row gap-4">
          <div className="flex flex-col items-center">
            <Link href={`/profile/${author.id}`} className="relative h-11 w-11">
              <Image
                src={author.image}
                fill
                alt="Profile image"
                className="cursor-pointer rounded-full"
              />
            </Link>
            <div className="thread-card_bar"></div>
          </div>
          <div className="flex w-full flex-col">
            <Link href={`/profile/${author.id}`} className="w-fit">
              <h4 className="cursor-pointer text-base-semibold text-light-1">
                {author.name}
              </h4>
            </Link>
            <p className="mt-2 text-small-regular text-light-2">{content}</p>
            <div className={`${isComment && "mb-10"} mt-5 flex flex-col gap-3`}>
              <div className="flex gap-3.5">
                <Image
                  src={"/assets/heart-gray.svg"}
                  alt="heart"
                  width={24}
                  height={24}
                  className="cursor-pointer object-contain"
                />
                <Link href={`/thread/${id}`}>
                  <Image
                    src={"/assets/reply.svg"}
                    alt="reply"
                    width={24}
                    height={24}
                    className="cursor-pointer object-contain"
                  />
                </Link>
                <Image
                  src={"/assets/repost.svg"}
                  alt="repost"
                  width={24}
                  height={24}
                  className="cursor-pointer object-contain"
                />
                <Image
                  src={"/assets/share.svg"}
                  alt="share"
                  width={24}
                  height={24}
                  className="cursor-pointer object-contain"
                />
              </div>
              {isComment && comments.length > 0 && (
                <Link href={`/thread/${id}`}>
                  <p className="mt-1 text-subtle-medium text-gray-1">
                    {comments.length} replies
                  </p>
                </Link>
              )}
            </div>
          </div>
        </div>
        {/* TODO: Show deleteThread */}
        {/* TODO: Show comment users logo */}
        {console.log("COMUNITY===", community)}
        {!isComment && community && (
          <Link
            href={`/communities/${community.id}`}
            className="mt-5 flex items-center">
            <p className="text-subtle-medium text-gray-1">
              {formatDateString(createdAt)} - {community.name}
            </p>
            <Image
              className="ml-1 rounded-full object-cover"
              alt={community.name}
              src={community.image}
              width={14}
              height={14}
            />
          </Link>
        )}
      </div>
    </article>
  );
};

export default ThreadCard;
