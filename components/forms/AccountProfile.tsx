"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Form,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userValidation } from "@/lib/validation/user";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as z from "zod";
import Image from "next/image";
import { ChangeEvent, useState } from "react";
import { isBase64Image } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthings";
import { updateUser } from "@/lib/actions/user.actions";
import { useRouter, usePathname } from "next/navigation";

interface props {
  user: {
    id: string;
    objectId: string;
    username: string;
    name: string;
    bio: string;
    image: string;
  };
  btnTitle: string;
}

const AccountProfile = ({ user, btnTitle }: props) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { startUpload } = useUploadThing("media");
  const router = useRouter();
  const pathname = usePathname();

  const form = useForm({
    resolver: zodResolver(userValidation),
    defaultValues: {
      profile_photo: user?.image || "",
      name: user?.name || "",
      username: user?.username || "",
      bio: user?.bio || "",
    },
  });

  async function onSubmit(values: z.infer<typeof userValidation>) {
    setIsSubmitting(true);
    try {
      const blob = values.profile_photo;
      const hasImageChanged = isBase64Image(blob);

      if (hasImageChanged) {
        let imgRes = await startUpload(files);
        if (imgRes && imgRes[0].url) {
          values.profile_photo = imgRes[0].url;
        }
      }
      await updateUser({
        userId: user.id,
        username: values.username,
        image: values.profile_photo,
        name: values.name,
        bio: values.bio,
        path: pathname,
      });
      if (pathname === "/profile/edit") {
        router.back();
      } else {
        router.push("/");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleImage = (
    e: ChangeEvent<HTMLInputElement>,
    fieldChange: (value: string) => void
  ) => {
    e.preventDefault();
    const fileReader = new FileReader();

    if (e.target.files && e.target.files?.length > 0) {
      const file = e.target.files[0];
      setFiles(Array.from(e.target.files));
      if (!file.type.includes("image")) return;

      fileReader.onload = async (event: ProgressEvent<FileReader>) => {
        const imageDataUrl = event.target?.result?.toString() || "";
        fieldChange(imageDataUrl);
      };
      fileReader.readAsDataURL(file);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-8"
      >
        {/* ── Avatar upload ── */}
        <FormField
          control={form.control}
          name="profile_photo"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-5">
                {/* Avatar preview */}
                <label
                  htmlFor="profile_photo_input"
                  className="group relative cursor-pointer"
                >
                  <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-dark-4 ring-offset-2 ring-offset-dark-2 transition-all group-hover:ring-primary-500">
                    {field.value ? (
                      <Image
                        src={field.value}
                        alt="Profile photo"
                        fill
                        sizes="80px"
                        priority
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-dark-3">
                        <Image
                          src="/assets/profile.svg"
                          alt="Upload photo"
                          width={28}
                          height={28}
                          className="opacity-50"
                        />
                      </div>
                    )}
                    {/* Overlay hint */}
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </div>
                  </div>
                </label>

                {/* Text + hidden input */}
                <div className="flex flex-col gap-1">
                  <p className="text-base-semibold text-light-1">
                    Profile photo
                  </p>
                  <p className="text-small-regular text-gray-1">
                    JPG, PNG or GIF · Max 4 MB
                  </p>
                  <label
                    htmlFor="profile_photo_input"
                    className="mt-1 cursor-pointer text-small-semibold text-primary-500 hover:underline"
                  >
                    Change photo
                  </label>
                </div>

                <FormControl>
                  <Input
                    id="profile_photo_input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImage(e, field.onChange)}
                  />
                </FormControl>
              </div>
              <FormMessage className="text-red-400 text-xs" />
            </FormItem>
          )}
        />

        {/* ── Divider ── */}
        <div className="h-px w-full bg-dark-4" />

        {/* ── Name ── */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <FormLabel className="text-small-semibold text-light-2">
                Full name
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="e.g. Alex Johnson"
                  {...field}
                  className="account-form_input h-11 rounded-xl px-4 text-base-regular placeholder:text-gray-1 focus:border-primary-500 focus:ring-0"
                />
              </FormControl>
              <FormMessage className="text-red-400 text-xs" />
            </FormItem>
          )}
        />

        {/* ── Username ── */}
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <FormLabel className="text-small-semibold text-light-2">
                Username
              </FormLabel>
              <FormControl>
                <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-dark-4 bg-dark-3 focus-within:border-primary-500 transition-colors">
                  <span className="flex h-11 items-center px-3 text-base-regular text-gray-1 select-none border-r border-dark-4">
                    @
                  </span>
                  <input
                    type="text"
                    placeholder="yourhandle"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                    className="h-11 flex-1 bg-transparent px-3 text-base-regular text-light-1 outline-none placeholder:text-gray-1"
                  />
                </div>
              </FormControl>
              <FormMessage className="text-red-400 text-xs" />
            </FormItem>
          )}
        />

        {/* ── Bio ── */}
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <FormLabel className="text-small-semibold text-light-2">
                  Bio
                </FormLabel>
                <span className="text-subtle-medium text-gray-1">
                  {(field.value ?? "").length}/1000
                </span>
              </div>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder="Tell people a bit about yourself…"
                  {...field}
                  className="account-form_input resize-none rounded-xl px-4 py-3 text-base-regular placeholder:text-gray-1 focus:border-primary-500 focus:ring-0"
                  maxLength={1000}
                />
              </FormControl>
              <FormMessage className="text-red-400 text-xs" />
            </FormItem>
          )}
        />

        {/* ── Submit ── */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 h-11 w-full rounded-xl bg-primary-500 text-base-semibold text-light-1 hover:bg-primary-500/90 disabled:opacity-50 transition-all"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
              </svg>
              Saving…
            </span>
          ) : (
            btnTitle
          )}
        </Button>
      </form>
    </Form>
  );
};

export default AccountProfile;