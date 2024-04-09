import AccountProfile from "@/components/forms/AccountProfile";
import { currentUser } from "@clerk/nextjs";

interface User {
  id: string | any;
  objectId: string | any;
  username: string | any;
  name: string | any;
  bio: string | any;
  image: string | any;
}

const page = async () => {
  const user = await currentUser();

  let userInfo = {};

  let userData: User = {
    id: user?.id,
    objectId: userInfo?._id,
    username: userInfo?.username || user?.username,
    name: userInfo?.name || user?.firstName || "",
    bio: userInfo?.bio || "",
    image: userInfo?.image || user?.imageUrl,
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col justify-start px-10 py-20">
      <h1 className="head-text">Onboarding</h1>
      <p className="mt-3 text-base-regular text-slate-50 ">
        Complete your profile now to use Thraed
      </p>
      <section className="mt-9 bg-dark-2 p-10 ">
        <AccountProfile user={userData} btnTitle="continue" />
      </section>
    </main>
  );
};

export default page;
