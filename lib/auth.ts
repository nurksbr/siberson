import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcrypt'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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

          if (user.isEmailVerified === false) {
            throw new Error('E-posta adresiniz doğrulanmamış. Lütfen e-postanızı kontrol edin ve hesabınızı doğrulayın.')
          }

          const isPasswordValid = await compare(credentials.password, user.password)

          if (!isPasswordValid) {
            throw new Error('Şifre hatalı')
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isAdmin: user.isAdmin
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
      if (token) {
        session.user.id = token.id
        session.user.name = token.name
        session.user.email = token.email
        session.user.isAdmin = token.isAdmin
      }
      return session
    },
    async jwt({ token, user }) {
      try {
        // Kullanıcı bilgisi varsa token'a ekle
        if (user) {
          token.id = user.id
          token.isAdmin = user.isAdmin
          return token
        }

        // Eğer yeni oturum değilse token'ı güncellemeye gerek yok
        if (Date.now() < ((token.exp as number) * 1000) - 5 * 60 * 1000) {
          return token
        }

        // Token süresi dolmak üzere, veritabanından kullanıcı bilgilerini yenile
        const dbUser = await prisma.user.findFirst({
          where: {
            email: token.email!
          }
        })

        if (!dbUser) {
          return token
        }

        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          isAdmin: dbUser.isAdmin,
          exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 gün sonra süre dolacak
        }
      } catch (error) {
        console.error('JWT callback hatası:', error)
        return token
      }
    }
  }
}