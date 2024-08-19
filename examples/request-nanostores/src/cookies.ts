import type { AstroCookies, AstroCookieSetOptions } from 'astro';
import type { CartItem } from './cartStore';

type CartCookie = Record<string, Pick<CartItem, 'id' | 'quantity'>>;

export const CART_COOKIE_NAME = 'cart';

export function cookieOptions(url: URL): AstroCookieSetOptions {
  return {
    path: '/',
    domain: url.hostname,
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 3600,
  };
}

export function extractCartCookie(cookies: AstroCookies): CartCookie {
  const cookie = cookies.get(CART_COOKIE_NAME);
  if (!cookie) return {};

  try {
    return cookie.json();
  } catch {
    return {};
  }
}
