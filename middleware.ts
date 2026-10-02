import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Notification URL DOKU memakai path yang sama dengan HACCP dashboard → arahkan ke handler training
  const dokuPath = process.env.DOKU_NOTIF_PATH;
  if (dokuPath && dokuPath !== '/api/doku/notification' && request.nextUrl.pathname === dokuPath) {
    const url = request.nextUrl.clone(); url.pathname = '/api/doku/notification';
    return NextResponse.rewrite(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && (request.nextUrl.pathname.startsWith('/akun') || request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/koordinator'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/masuk';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.png|logo-emki.png).*)'] };
