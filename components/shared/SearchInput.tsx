"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useEffect, useState } from "react";
import Image from "next/image";

export default function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  // Debounce: only push to URL 300ms after the user stops typing
  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [value, pathname, router, searchParams]);

  return (
    <div className="searchbar">
      <Image
        src="/assets/search-gray.svg"
        alt=""
        aria-hidden="true"
        width={24}
        height={24}
      />
      <input
        type="search"
        placeholder="Search users…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="searchbar_input"
        aria-label="Search users"
      />
      {isPending && (
        <span className="text-subtle-medium text-gray-1">Searching…</span>
      )}
    </div>
  );
}