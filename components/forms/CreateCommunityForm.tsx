"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useUploadThing } from "@/lib/uploadthings";
import { isBase64Image } from "@/lib/utils";
import { createCommunity } from "@/lib/actions/community.action";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  name: z.string().min(2, "At least 2 characters").max(50),
  username: z
    .string()
    .min(2, "At least 2 characters")
    .max(30)
    .regex(/^[a-z0-9_-]+$/, "Only lowercase letters, numbers, _ and -"),
  bio: z.string().max(500).optional(),
  image: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateCommunityFormProps {
  creatorClerkId: string;
}

export default function CreateCommunityForm({
  creatorClerkId,
}: CreateCommunityFormProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [serverError, setServerError] = useState("");
  const { startUpload } = useUploadThing("media");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", username: "", bio: "", image: "" },
  });

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (v: string) => void
  ) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    if (!file || !file.type.includes("image")) return;
    setFiles([file]);
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result?.toString() ?? "");
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: FormValues) => {
    setServerError("");
    let imageUrl = values.image ?? "";

    if (imageUrl && isBase64Image(imageUrl) && files.length) {
      const res = await startUpload(files);
      if (res?.[0]?.url) imageUrl = res[0].url;
    }

    const result = await createCommunity({
      name: values.name,
      username: values.username,
      bio: values.bio ?? "",
      image: imageUrl,
      creatorClerkId,
    });

    if (!result.success) {
      setServerError(result.error ?? "Failed to create community");
      return;
    }

    router.push(`/communities/${values.username}`);
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-7">

        {/* ── Community image ── */}
        <FormField
          control={form.control}
          name="image"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-5">
                {/* Avatar preview */}
                <label
                  htmlFor="community_image_input"
                  className="group relative cursor-pointer shrink-0"
                >
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl ring-2 ring-dark-4 ring-offset-2 ring-offset-dark-2 transition-all group-hover:ring-primary-500">
                    {field.value ? (
                      <Image
                        src={field.value}
                        alt="Community image"
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-dark-4">
                        <Image
                          src="/assets/community.svg"
                          alt="Upload"
                          width={30}
                          height={30}
                          className="opacity-40"
                        />
                      </div>
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </div>
                  </div>
                </label>

                <div className="flex flex-col gap-1">
                  <p className="text-base-semibold text-light-1">Community image</p>
                  <p className="text-small-regular text-gray-1">
                    Recommended 400×400 · JPG or PNG
                  </p>
                  <label
                    htmlFor="community_image_input"
                    className="mt-1 cursor-pointer text-small-semibold text-primary-500 hover:underline"
                  >
                    Upload image
                  </label>
                </div>

                <FormControl>
                  <Input
                    id="community_image_input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageChange(e, field.onChange)}
                  />
                </FormControl>
              </div>
            </FormItem>
          )}
        />

        {/* ── Divider ── */}
        <div className="h-px w-full bg-dark-4" />

        {/* ── Community name ── */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <FormLabel className="text-small-semibold text-light-2">
                Community name
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. React Developers"
                  {...field}
                  className="account-form_input h-11 rounded-xl px-4 text-base-regular placeholder:text-gray-1 focus:border-primary-500 focus:ring-0"
                />
              </FormControl>
              <FormMessage className="text-red-400 text-xs" />
            </FormItem>
          )}
        />

        {/* ── Handle ── */}
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <FormLabel className="text-small-semibold text-light-2">
                Community handle
              </FormLabel>
              <FormControl>
                <div className="flex items-center overflow-hidden rounded-xl border border-dark-4 bg-dark-3 focus-within:border-primary-500 transition-colors">
                  <span className="flex h-11 items-center px-3 text-base-regular text-gray-1 select-none border-r border-dark-4">
                    c/
                  </span>
                  <input
                    type="text"
                    placeholder="react_devs"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                    className="h-11 flex-1 bg-transparent px-3 text-base-regular text-light-1 outline-none placeholder:text-gray-1"
                  />
                </div>
              </FormControl>
              <p className="text-subtle-medium text-gray-1">
                Only lowercase letters, numbers, _ and –
              </p>
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
                  Bio{" "}
                  <span className="text-gray-1 font-normal">(optional)</span>
                </FormLabel>
                <span className="text-subtle-medium text-gray-1">
                  {(field.value ?? "").length}/500
                </span>
              </div>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="What is this community about?"
                  {...field}
                  maxLength={500}
                  className="account-form_input resize-none rounded-xl px-4 py-3 text-base-regular placeholder:text-gray-1 focus:border-primary-500 focus:ring-0"
                />
              </FormControl>
              <FormMessage className="text-red-400 text-xs" />
            </FormItem>
          )}
        />

        {/* ── Server error ── */}
        {serverError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-small-regular text-red-400">{serverError}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 h-11 w-full rounded-xl bg-primary-500 text-base-semibold text-light-1 hover:bg-primary-500/90 disabled:opacity-50 transition-all"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
              </svg>
              Creating…
            </span>
          ) : (
            "Create community"
          )}
        </Button>
      </form>
    </Form>
  );
}