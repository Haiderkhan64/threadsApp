"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "./../ui/button";
interface params {
  id: string;
  name: string;
  userName: string;
  ImgUrl: string;
  personType: string;
}
const UserCard = ({ id, name, userName, ImgUrl, personType }: params) => {
  const router = useRouter();

  return (
    <article className="user-card">
      <div className="user-card_avatar">
        <Image
          src={ImgUrl}
          height={48}
          width={48}
          alt="logo"
          className="rounded-full"
        />
        <div className="flex-1 text-ellipsis">
          <h4 className="text-base-semibold text-light-1">{name}</h4>
          <p className="text-small-medium text-gray-1">{userName}</p>
        </div>
        <Button
          className="user-card_btn"
          onClick={() => {
            router.push(`/profile/${id}`);
          }}>
          Viwe
        </Button>
      </div>
    </article>
  );
};

export default UserCard;
