"use client";
import Link from "next/link.js";
import { sidebarLinks } from "../../constants/index.js";
import Image from "next/image.js";
import { usePathname, useRouter } from "next/navigation.js";
import { SignedIn, SignOutButton, useAuth } from "@clerk/nextjs";
import page from "@/app/(root)/create-thread/page.jsx";

const LeftSideBar = () => {
  let router = useRouter();
  let pathname = usePathname();
  const { userId } = useAuth();
  return (
    <section className="custom-scrollbar leftsidebar">
      <div className="flex w-full flex-1 flex-col gap-6 px-6">
        {sidebarLinks.map((link) => {
          let isActive: boolean =
            (pathname.includes(link.route) && link.route.length > 1) ||
            pathname === link.route;
          if (link.route == "/profile") link.route = `${link.route}/${userId}`;
          return (
            <Link
              href={link.route}
              className={`leftsidebar_link ${isActive ? "bg-primary-500" : ""}`}
              key={link.label}>
              <Image
                src={link.imgURL}
                alt={link.label}
                width={24}
                height={24}
              />

              <p className="text-light-1 max-lg:hidden">{link.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 px-6">
        <SignedIn>
          <SignOutButton signOutCallback={() => router.push("/sign-in")}>
            <div className="flex cursor-pionter gap-4 p-4">
              <Image
                src="/assets/logout.svg"
                alt="logout"
                width={24}
                height={24}
              />
              <p className="text-light-2 max-lg:hidden">LogOut</p>
            </div>
          </SignOutButton>
        </SignedIn>
      </div>
    </section>
  );
};

export default LeftSideBar;
