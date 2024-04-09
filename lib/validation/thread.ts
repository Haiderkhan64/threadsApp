import * as z from "zod";

export const threadValidation = z.object({
  thread: z.string().min(3, { message: "Minimum 3 Characters" }).max(1000),
  id: z.string(),
});

export const commentValidation = z.object({
  thread: z.string().min(3, { message: "Minimum 3 Characters" }).max(1000),
});
