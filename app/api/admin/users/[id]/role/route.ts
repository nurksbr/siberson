import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { Role } from '@/prisma/generated/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Token tabanlı admin yetki kontrolü
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value
    
    if (!token) {
      const cookieToken = request.headers.get('cookie')?.match(/auth_token=([^;]+)/)?.[1]
      if (!cookieToken) {
        return NextResponse.json(
          { error: 'Yetkilendirme token\'i bulunamadı' },
          { status: 401 }
        )
      }
    }

    let currentUserId: string
    try {
      const decoded = jwt.verify(
        token || request.headers.get('cookie')?.match(/auth_token=([^;]+)/)?.[1] || '',
        process.env.JWT_SECRET || 'fallback-secret'
      ) as { id: string }
      currentUserId = decoded.id
    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Geçersiz token' },
        { status: 401 }
      )
    }

    // Kullanıcıyı kontrol et ve admin yetkisini doğrula
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { id: true, role: true, email: true }
    })

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Admin yetkiniz bulunmuyor.' },
        { status: 403 }
      )
    }

    const userId = params.id
    const { role } = await request.json()

    // Rol doğrulaması
    if (!role || !['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Geçersiz rol değeri' },
        { status: 400 }
      )
    }

    // Kendi rolünü değiştirmeye çalışıyor mu kontrol et
    if (currentUser.id === userId) {
      return NextResponse.json(
        { error: 'Kendi rolünüzü değiştiremezsiniz' },
        { status: 400 }
      )
    }

    // Kullanıcıyı güncelle
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: role as Role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isEmailVerified: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(
      { 
        message: 'Kullanıcı rolü başarıyla güncellendi',
        user: updatedUser 
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Rol güncelleme hatası:', error)
    return NextResponse.json(
      { error: 'Rol güncellenirken hata oluştu' },
      { status: 500 }
    )
  }
} 