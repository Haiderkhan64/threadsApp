import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { currentUser } from "@clerk/nextjs";

import TopBar from "@/components/shared/TopBar";
import LeftSideBar from "@/components/shared/LeftSideBar";
import RightSideBar from "@/components/shared/RightSideBar";
import BottomBar from "@/components/shared/BottomBar";
import { VideoCallOverlay } from "@/components/video-call/VideoCallOverlay";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Thread",
  description: "A Next.js 14 meta Threads Application",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();

  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en">
        <body className={inter.className}>
          {/*
            VideoCallOverlay is a fixed-position overlay that must live
            inside <body> — placing it outside <body> is invalid HTML and
            causes React hydration errors. Conditionally rendered only when
            a Clerk session exists so the WebSocket is never opened for
            unauthenticated visitors.
          */}
          {user && (
            <VideoCallOverlay
              currentUserId={user.id}
              currentUserName={user.firstName ?? ""}
              currentUserImage={user.imageUrl}
            />
          )}

          <TopBar />

          <main className="flex flex-row">
            <LeftSideBar />
            <section className="main-container">
              <div className="w-full max-w-4xl">{children}</div>
            </section>
            <RightSideBar />
          </main>

          <BottomBar />
        </body>
      </html>
    </ClerkProvider>
  );
}