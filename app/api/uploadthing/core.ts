import { auth } from "@clerk/nextjs"; // Changed from currentUser
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

export const ourFileRouter = {
  media: f({ image: { maxFileSize: "4MB", maxFileCount: 4 } })
    .middleware(async ({ req }) => {
      // Use auth() instead of currentUser() for a massive performance boost
      const { userId } = auth();

      // If there is no userId, the user is not logged in
      if (!userId) throw new UploadThingError("Unauthorized");

      // Pass the userId to the upload complete callback
      return { userId: userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("file url", file.url);

      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;