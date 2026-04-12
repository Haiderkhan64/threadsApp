"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Form,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, usePathname } from "next/navigation";
import { createThread } from "@/lib/actions/thread.action";
import Image from "next/image";
import { useRef, useState, useEffect, useCallback } from "react";
import { useUploadThing } from "@/lib/uploadthings";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JoinedCommunity {
  _id: string;
  name: string;
  username: string;
  image: string;
}

interface PostThreadProps {
  userId: string;
  userImage?: string;
  userName?: string;
  joinedCommunities: JoinedCommunity[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CHARS = 500;
const WARN_THRESHOLD = 0.8;
const MAX_IMAGES = 4;

const formSchema = z.object({
  thread: z.string().min(3, "Minimum 3 characters").max(MAX_CHARS),
  communityId: z.string().optional(),
});

// ── CharacterRing ─────────────────────────────────────────────────────────────

function CharacterRing({ count, max }: { count: number; max: number }) {
  const pct = count / max;
  const isWarn = pct >= WARN_THRESHOLD;
  const isDanger = pct >= 1;
  const r = 10;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct, 1);
  const color = isDanger ? "#ef4444" : isWarn ? "#f59e0b" : "#877EFF";
  const remaining = max - count;
  if (count === 0) return null;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 28, height: 28 }}>
      <svg width={28} height={28} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={14} cy={14} r={r} fill="none" stroke="#1F1F22" strokeWidth={2.5} />
        <circle
          cx={14} cy={14} r={r} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.2s ease, stroke 0.2s ease" }}
        />
      </svg>
      {isWarn && (
        <span className="absolute text-[9px] font-semibold" style={{ color, fontSize: 8 }}>
          {remaining < 0 ? `+${Math.abs(remaining)}` : remaining}
        </span>
      )}
    </div>
  );
}

// ── ImagePreview ──────────────────────────────────────────────────────────────

function ImagePreview({
  images,
  onRemove,
}: {
  images: { url: string; isUploading: boolean; localUrl: string }[];
  onRemove: (index: number) => void;
}) {
  if (images.length === 0) return null;

  const gridClass =
    images.length === 1
      ? "grid-cols-1"
      : images.length === 2
      ? "grid-cols-2"
      : images.length === 3
      ? "grid-cols-2"
      : "grid-cols-2";

  return (
    <div className={`grid gap-2 mt-3 ${gridClass}`}>
      {images.map((img, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-xl bg-dark-4"
          style={{
            aspectRatio: images.length === 1 ? "16/9" : "1/1",
            // Third image in 3-image layout spans full width
            gridColumn: images.length === 3 && i === 2 ? "1 / -1" : undefined,
          }}
        >
          <Image
            src={img.localUrl}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            alt={`Attached image ${i + 1}`}
            className="object-cover"
            style={{ opacity: img.isUploading ? 0.5 : 1, transition: "opacity 0.2s" }}
          />

          {/* Uploading spinner overlay */}
          {img.isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
              <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#877EFF" strokeWidth="3"
                  strokeDasharray="31.4 31.4" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {/* Remove button */}
          {!img.isUploading && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition-all hover:bg-black/90 hover:scale-110"
              aria-label="Remove image"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const PostThread = ({
  userId,
  userImage = "/assets/user.svg",
  userName = "You",
  joinedCommunities,
}: PostThreadProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Images: each entry tracks local preview URL + upload status + final URL
  const [images, setImages] = useState<
    { localUrl: string; url: string; isUploading: boolean; file: File }[]
  >([]);

  const { startUpload } = useUploadThing("media");

  useEffect(() => {
    setMounted(true);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { thread: "", communityId: "" },
  });

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // ── Handle image file selection ──────────────────────────────────────────
  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;

      // Cap total
      const remaining = MAX_IMAGES - images.length;
      const toAdd = files.slice(0, remaining);
      if (!toAdd.length) return;

      // Reset input so the same file can be re-selected
      e.target.value = "";

      // Create optimistic previews
      const previews = toAdd.map((file) => ({
        localUrl: URL.createObjectURL(file),
        url: "",
        isUploading: true,
        file,
      }));

      setImages((prev) => [...prev, ...previews]);

      // Upload each file
      try {
        const results = await startUpload(toAdd);
        if (results) {
          setImages((prev) => {
            const next = [...prev];
            results.forEach((res, ri) => {
              // Match by localUrl position (the last `toAdd.length` items)
              const idx = next.length - toAdd.length + ri;
              if (next[idx]) {
                next[idx] = { ...next[idx], url: res.url, isUploading: false };
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.error("Image upload failed:", err);
        // Remove failed uploads
        setImages((prev) => prev.filter((img) => !img.isUploading));
      }
    },
    [images.length, startUpload]
  );

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].localUrl);
      next.splice(index, 1);
      return next;
    });
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isSubmitting) return;

    // Wait for any in-progress uploads
    const stillUploading = images.some((img) => img.isUploading);
    if (stillUploading) return;

    setIsSubmitting(true);
    try {
      await createThread({
        text: values.thread,
        author: userId,
        communityId: values.communityId || null,
        path: pathname,
        images: images.map((img) => img.url).filter(Boolean),
      });
      router.push("/");
    } catch {
      setIsSubmitting(false);
    }
  };

  const threadValue = form.watch("thread");
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = !threadValue.trim();
  const hasUploadingImages = images.some((img) => img.isUploading);
  const canPost = !isEmpty && !isOverLimit && !isSubmitting && !hasUploadingImages;

  return (
    <div
      className="w-full"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* ── Composer card ── */}
          <div
            className="rounded-2xl border transition-all duration-300"
            style={{
              background: "linear-gradient(145deg, #121417 0%, #101012 100%)",
              borderColor: isFocused ? "#877EFF44" : "#1F1F22",
              boxShadow: isFocused
                ? "0 0 0 1px #877EFF22, 0 8px 40px rgba(135, 126, 255, 0.08)"
                : "0 2px 16px rgba(0,0,0,0.4)",
            }}
          >
            {/* ── Top: avatar + textarea ── */}
            <div className="flex gap-3 p-5 pb-3">
              <div className="flex flex-col items-center gap-0 pt-0.5">
                <div className="relative flex-shrink-0 rounded-full overflow-hidden" style={{ width: 40, height: 40 }}>
                  <Image src={userImage} fill sizes="40px" alt={userName} className="object-cover" />
                </div>
                <div
                  className="w-px flex-1 mt-2 rounded-full"
                  style={{
                    background: "linear-gradient(to bottom, #877EFF33, transparent)",
                    minHeight: 16,
                    opacity: isFocused ? 1 : 0,
                    transition: "opacity 0.3s ease",
                  }}
                />
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <p className="text-small-semibold text-light-1 leading-none mb-2">{userName}</p>

                <FormField
                  control={form.control}
                  name="thread"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <textarea
                          {...field}
                          ref={(el) => {
                            (textareaRef as any).current = el;
                            if (typeof field.ref === "function") field.ref(el);
                          }}
                          placeholder="What's on your mind?"
                          onFocus={() => setIsFocused(true)}
                          onBlur={() => setIsFocused(false)}
                          onChange={(e) => {
                            field.onChange(e);
                            setCharCount(e.target.value.length);
                            autoResize();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              form.handleSubmit(onSubmit)();
                            }
                          }}
                          rows={3}
                          className="w-full resize-none bg-transparent border-none outline-none text-light-1 placeholder-gray-1 text-base leading-relaxed"
                          style={{ fontSize: "15px", lineHeight: "1.6", minHeight: "72px", maxHeight: "320px", overflowY: "auto" }}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs mt-1" />
                    </FormItem>
                  )}
                />

                {/* ── Image previews ── */}
                <ImagePreview images={images} onRemove={removeImage} />

                {/* ── Upload progress notice ── */}
                {hasUploadingImages && (
                  <p className="text-[11px] text-primary-500 mt-1 flex items-center gap-1.5">
                    <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                    Uploading images…
                  </p>
                )}
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-5" style={{ height: 1, background: "linear-gradient(to right, #877EFF11, #1F1F22, #877EFF11)" }} />

            {/* ── Footer bar ── */}
            <div className="flex items-center justify-between px-5 py-3">
              {/* Left: attachment actions */}
              <div className="flex items-center gap-1">
                {/* Image upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={images.length >= MAX_IMAGES}
                  aria-label="Add image"
                  title={images.length >= MAX_IMAGES ? `Max ${MAX_IMAGES} images` : "Add photo"}
                  className="flex items-center justify-center h-8 w-8 rounded-lg transition-all hover:bg-dark-4 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    color: images.length > 0 ? "#877EFF" : "#697C89",
                    opacity: isFocused || images.length > 0 ? 1 : 0.5,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  {images.length > 0 && (
                    <span className="ml-0.5 text-[10px] font-bold" style={{ color: "#877EFF" }}>
                      {images.length}
                    </span>
                  )}
                </button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />

                {/* Community selector */}
                <div className="flex items-center gap-1.5 text-gray-1 ml-1">
                  <span style={{ fontSize: 12 }}>🌐</span>
                  <FormField
                    control={form.control}
                    name="communityId"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <select
                            {...field}
                            className="bg-transparent text-subtle-medium outline-none cursor-pointer hover:text-light-3 transition-colors appearance-none"
                            style={{ fontSize: 12 }}
                          >
                            <option value="" className="bg-dark-2 text-light-1">Anyone can reply (Public)</option>
                            {joinedCommunities.map((c) => (
                              <option key={c._id} value={c._id} className="bg-dark-2 text-light-1">
                                Post in {c.name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Right: ring + submit */}
              <div className="flex items-center gap-3">
                <CharacterRing count={charCount} max={MAX_CHARS} />

                <span
                  className="text-subtle-medium text-gray-1 hidden sm:block"
                  style={{ fontSize: 11, opacity: isFocused ? 0.7 : 0 }}
                >
                  ⌘ Return to post
                </span>

                <button
                  type="submit"
                  disabled={!canPost}
                  className="relative overflow-hidden rounded-full font-semibold transition-all duration-200 select-none"
                  style={{
                    padding: "8px 20px",
                    fontSize: 14,
                    background: !canPost ? "#1F1F22" : "linear-gradient(135deg, #877EFF 0%, #6B5FE4 100%)",
                    color: !canPost ? "#5C5C7B" : "#ffffff",
                    cursor: !canPost ? "not-allowed" : "pointer",
                    transform: isSubmitting ? "scale(0.96)" : "scale(1)",
                    boxShadow: !canPost ? "none" : "0 4px 20px rgba(135, 126, 255, 0.35)",
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Posting…
                    </span>
                  ) : hasUploadingImages ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                      Uploading…
                    </span>
                  ) : (
                    "Post"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── Secondary thread preview ── */}
          <div
            className="mt-2 flex gap-3 px-5 py-3 rounded-2xl transition-all duration-300"
            style={{
              background: "#121417",
              border: "1px solid #1F1F22",
              opacity: isFocused && !isEmpty ? 0.55 : 0,
              transform: isFocused && !isEmpty ? "translateY(0)" : "translateY(-4px)",
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="rounded-full overflow-hidden flex-shrink-0" style={{ width: 28, height: 28, background: "#1F1F22", border: "1px solid #2a2a2e" }} />
            </div>
            <div className="flex flex-col gap-1 pt-0.5">
              <span className="text-gray-1" style={{ fontSize: 13 }}>Add to thread</span>
            </div>
          </div>
        </form>
      </Form>

      <p className="text-center text-subtle-medium text-gray-1 mt-6" style={{ fontSize: 11, opacity: 0.5 }}>
        Threads up to {MAX_CHARS} characters · Up to {MAX_IMAGES} photos · ⌘+Return to post quickly
      </p>
    </div>
  );
};

export default PostThread;