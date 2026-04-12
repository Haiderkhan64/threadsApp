"use client";

import { usePathname } from "next/navigation";
import { useTransition } from "react";
import Image from "next/image";
import { deleteThread } from "@/lib/actions/thread.action";

interface DeleteThreadButtonProps {
  threadId: string;
}

export default function DeleteThreadButton({ threadId }: DeleteThreadButtonProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteThread(threadId, pathname);
    });
  };

  return (
    <button
      type="button"
      aria-label="Delete thread"
      disabled={isPending}
      onClick={handleDelete}
      className="rounded p-0.5 opacity-60 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <Image
        src="/assets/delete.svg"
        alt=""
        width={18}
        height={18}
        className={`object-contain ${isPending ? "animate-pulse" : ""}`}
      />
    </button>
  );
}