import { NextResponse } from 'next/server'

const SECRET = process.env.ACCESS_SECRET

export function middleware(request) {
  // Deixa passar arquivos estáticos internos do Next
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  // Verifica cookie
  const cookie = request.cookies.get('auth')?.value
  if (cookie === SECRET) return NextResponse.next()

  // Login via query param: /?secret=SUA_SENHA
  const provided = request.nextUrl.searchParams.get('secret')
  if (provided && provided === SECRET) {
    const url = request.nextUrl.clone()
    url.searchParams.delete('secret')
    const res = NextResponse.redirect(url)
    res.cookies.set('auth', SECRET, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      path: '/',
    })
    return res
  }

  return new NextResponse('Acesso negado', { status: 401 })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
```

Depois, no painel do Vercel → Settings → Environment Variables, adicione:
```
ACCESS_SECRET = uma_senha_longa_e_aleatoria