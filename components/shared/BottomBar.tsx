"use client";
import Image from "next/image";
import { sidebarLinks } from "@/constants";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const BottomBar = () => {
  let router = useRouter();
  let pathname = usePathname();
  return (
    <section className="bottombar">
      {/* <div className="flex w-full flex-1 flex gap-8 px-6"> */}
      <div className="bottombar_container">
        {sidebarLinks.map((link) => {
          let isActive =
            (pathname.includes(link.route) && link.route.length > 1) ||
            pathname === link.route;
          if (link.route == "/profile") link.route = `${link.route}/${userId}`;
          return (
            <Link
              href={link.route}
              className={`bottombar_link ${isActive ? "bg-primary-500" : ""}`}
              key={link.label}>
              <Image
                src={link.imgURL}
                alt={link.label}
                width={24}
                height={24}
              />

              <p
                className="text-subtle-medium text-light-1
                 max-sm:hidden">
                {link.label.split(/\s+./)[0]}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default BottomBar;
