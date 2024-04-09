import ProfileHeader from "@/components/shared/ProfileHeader";
import { profileTabs } from "@/constants";
import { fetchUser, fetchUsers } from "@/lib/actions/user.actions";
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Image from "next/image";
import UserCard from "@/components/carde/UserCard";

const page = async () => {
  const user = await currentUser();
  if (!user) return null;

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  const result = await fetchUsers({
    userId: user.id,
    searchString: "",
    pageSize: 25,
    pageNo: 1,
    sortBy: "desc",
  });

  return (
    <section>
      <h1 className="text-light-1 head-text mb-10">Search</h1>;
      <div className="mt-14 flex-col gap-9">
        {result?.users.length === 0 ? (
          <p className="no-users">No Users Found</p>
        ) : (
          <>
            {result?.users.map((person: any) => {
              return (
                <UserCard
                  key={person.id}
                  id={person.id}
                  name={person.name}
                  userName={person.username}
                  ImgUrl={person.image}
                  personType="User"
                />
              );
            })}
          </>
        )}
      </div>
    </section>
  );
};

export default page;
