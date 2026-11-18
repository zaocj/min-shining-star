import { z } from 'zod';

// 当前页面只使用姓名，其余请柬内容暂不参与展示。
export const coupleSchema = z.object({
  groom: z.object({ name: z.string().trim().min(1) }),
  bride: z.object({ name: z.string().trim().min(1) }),
});

export type Couple = z.infer<typeof coupleSchema>;
