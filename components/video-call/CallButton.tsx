"use client";

interface CallButtonProps {
  targetUserId: string;
  targetName: string;
}

export function CallButton({ targetUserId, targetName }: CallButtonProps) {
  const handleCall = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__startVideoCall?.(targetUserId, targetName);
  };

  return (
    <button
      onClick={handleCall}
      aria-label="Video call"
      className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-transparent cursor-pointer text-gray-1 transition-colors duration-200 hover:bg-dark-3 hover:text-light-1"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    </button>
  );
}