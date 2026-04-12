"use client";

import { useEffect, useState } from "react";
import { CallButton } from "./CallButton";

interface Props {
  targetUserId: string;
  targetName: string;
}

export const CallHeaderActions = ({ targetUserId, targetName }: Props) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a same-size placeholder on the server to avoid layout shift
  if (!mounted) return <div className="h-8 w-8" />;

  return <CallButton targetUserId={targetUserId} targetName={targetName} />;
};