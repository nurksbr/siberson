import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

export async function GET(request: NextRequest) {
  try {
    // Token tabanlı admin yetki kontrolü
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value
    
    if (!token) {
      // Cookie'den de token almaya çalış
      const cookieToken = request.headers.get('cookie')?.match(/auth_token=([^;]+)/)?.[1]
      if (!cookieToken) {
        return NextResponse.json(
          { error: 'Yetkilendirme token\'i bulunamadı' },
          { status: 401 }
        )
      }
    }

    let userId: string
    try {
      const decoded = jwt.verify(
        token || request.headers.get('cookie')?.match(/auth_token=([^;]+)/)?.[1] || '',
        process.env.JWT_SECRET || 'fallback-secret'
      ) as { id: string }
      userId = decoded.id
    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Geçersiz token' },
        { status: 401 }
      )
    }

    // Kullanıcıyı kontrol et ve admin yetkisini doğrula
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true }
    })

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Admin yetkiniz bulunmuyor.' },
        { status: 403 }
      )
    }

    // Tüm kullanıcıları getir
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(
      { 
        users,
        count: users.length 
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Admin users API hatası:', error)
    return NextResponse.json(
      { error: 'Kullanıcılar getirilemedi' },
      { status: 500 }
    )
  }
} 