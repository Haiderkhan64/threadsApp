"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface UserCardProps {
  id: string;
  name: string;
  userName: string;
  imgUrl: string;
  personType: "User" | "Community";
  viewType?: boolean;
}

export default function UserCard({
  id,
  name,
  userName,
  imgUrl,
  viewType = true,
}: UserCardProps) {
  const router = useRouter();

  const destination = viewType ? `/profile/${id}` : `/thread-chat/${id}`;
  const buttonLabel = viewType ? "View" : "Message";

  return (
    <article className="user-card">
      <div className="user-card_avatar">
        <div className="relative h-12 w-12 shrink-0">
          <Image
            src={imgUrl}
            fill
            sizes="48px"
            alt={`${name}'s avatar`}
            className="rounded-full object-cover"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <h4 className="text-base-semibold text-light-1 truncate">{name}</h4>
          <p className="text-small-medium text-gray-1 truncate">@{userName}</p>
        </div>

        <Button
          className="user-card_btn shrink-0"
          aria-label={`${buttonLabel} ${name}'s profile`}
          onClick={() => router.push(destination)}
        >
          {buttonLabel}
        </Button>
      </div>
    </article>
  );
}