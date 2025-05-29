import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcrypt'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 gün
  },
  pages: {
    signIn: '/giris',
    error: '/auth-error',  // Hata sayfası
    signOut: '/cikis'
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET || 'sibergercek-gizli-anahtar',
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Şifre', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Geçersiz giriş bilgileri')
        }

        try {
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            }
          })

          if (!user) {
            throw new Error('Kullanıcı bulunamadı')
          }

          // E-posta doğrulama kontrolünü kaldırdık - artık tüm kullanıcılar giriş yapabilir
          // Gelecekte yeni kayıt olan kullanıcılar için e-posta doğrulama sistemi ayrı olarak işlenecek

          const isPasswordValid = await compare(credentials.password, user.password)

          if (!isPasswordValid) {
            throw new Error('Şifre hatalı')
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name || user.email.split('@')[0],
            role: user.role || 'USER',
            isAdmin: user.isAdmin || false
          }
        } catch (error) {
          console.error('Auth hatası:', error)
          throw error
        }
      }
    })
  ],
  callbacks: {
    async session({ token, session }) {
      if (token && session.user) {
        session.user.id = token.id
        session.user.name = token.name || session.user.email.split('@')[0]
        session.user.email = token.email || session.user.email
        session.user.role = token.role
        session.user.isAdmin = token.isAdmin
      }
      return session
    },
    async jwt({ token, user }) {
      try {
        // Kullanıcı bilgisi varsa token'a ekle
        if (user) {
          token.id = user.id
          token.role = user.role
          token.isAdmin = user.isAdmin
          return token
        }

        // Eğer yeni oturum değilse token'ı güncellemeye gerek yok
        if (token.exp && typeof token.exp === 'number' && Date.now() < (token.exp * 1000) - 5 * 60 * 1000) {
          return token
        }

        // Token süresi dolmak üzere, veritabanından kullanıcı bilgilerini yenile
        if (token.email) {
          const dbUser = await prisma.user.findFirst({
            where: {
              email: token.email
            }
          })

          if (dbUser) {
            token.id = dbUser.id
            token.name = dbUser.name || dbUser.email.split('@')[0]
            token.email = dbUser.email
            token.role = dbUser.role || 'USER'
            token.isAdmin = dbUser.isAdmin || false
          }
        }

        return token
      } catch (error) {
        console.error('JWT callback hatası:', error)
        return token
      }
    }
  }
}