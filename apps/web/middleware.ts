import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Rotas públicas
  const publicRoutes = ['/login', '/signup']
  const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  // Verificar se tem cookie de sessão do Supabase
  // Supabase usa cookies com prefixo sb-{project-ref}-auth-token
  const hasAuthCookie = req.cookies.getAll().some(cookie => 
    cookie.name.includes('auth-token') || cookie.name.includes('sb-')
  )

  // Se não está autenticado e tenta acessar rota protegida
  if (!hasAuthCookie && !isPublicRoute) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  // Se está autenticado e tenta acessar rota pública
  if (hasAuthCookie && isPublicRoute) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

