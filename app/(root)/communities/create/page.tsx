import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { fetchUser } from "@/lib/actions/user.actions";
import CreateCommunityForm from "@/components/forms/CreateCommunityForm";

export const metadata: Metadata = {
  title: "Create Community · Thread",
};

export default async function CreateCommunityPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userInfo = await fetchUser(user.id);
  if (!userInfo?.onboarded) redirect("/onboarding");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="head-text">Create a Community</h1>
        <p className="mt-2 text-base-regular text-light-3">
          Build a space for people who share your interests.
        </p>
      </div>

      <section className="rounded-xl bg-dark-2 p-8">
        <CreateCommunityForm creatorClerkId={user.id} />
      </section>
    </main>
  );
}