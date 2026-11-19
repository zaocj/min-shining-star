import type { APIRoute } from 'astro';
import { getInvitationBySlug } from '../../../../lib/services/invitations';

export const ALL: APIRoute = ({ params, request }) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const respond = (body: unknown, status: number, extra = {}) => new Response(request.method === 'HEAD' ? null : JSON.stringify(body), { status, headers: { ...headers, ...extra } });
  if (!['GET', 'HEAD'].includes(request.method)) {
    return respond({ error: { code: 'METHOD_NOT_ALLOWED', message: '此接口仅支持 GET 和 HEAD。' } }, 405, { Allow: 'GET, HEAD' });
  }
  try {
    const data = getInvitationBySlug(params.slug ?? '');
    return data ? respond({ data }, 200)
      : respond({ error: { code: 'INVITATION_NOT_FOUND', message: '未找到请柬，请检查链接是否完整、正确。' } }, 404);
  } catch (error) {
    console.error('[invitation-api] Failed to load invitation', params.slug, error);
    return respond({ error: { code: 'INVITATION_UNAVAILABLE', message: '暂时无法打开请柬，请稍后重试。' } }, 500);
  }
};
