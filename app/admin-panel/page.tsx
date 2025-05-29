'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'
import { FaUsers, FaChartBar, FaCog, FaShieldAlt, FaDatabase, FaExclamationTriangle, FaCheckCircle, FaUserShield, FaEnvelope, FaClipboard } from 'react-icons/fa'

interface User {
  id: string
  name: string
  email: string
  role: string
  isEmailVerified: boolean
  createdAt: string
}

interface SystemStats {
  totalUsers: number
  verifiedUsers: number
  adminUsers: number
  recentRegistrations: number
}

export default function AdminPanel() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    verifiedUsers: 0,
    adminUsers: 0,
    recentRegistrations: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

  // Admin yetkisi kontrolü
  useEffect(() => {
    if (!loading && (!user || user.role !== 'ADMIN')) {
      router.push('/')
      return
    }
  }, [user, loading, router])

  // Sayfa yüklendiğinde verileri getir
  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      
      // Token'ı localStorage'dan al
      const token = localStorage.getItem('cyberly_token')
      
      // Kullanıcıları getir
      const usersResponse = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setUsers(usersData.users || [])
        
        // İstatistikleri hesapla
        const totalUsers = usersData.users?.length || 0
        const verifiedUsers = usersData.users?.filter((u: User) => u.isEmailVerified).length || 0
        const adminUsers = usersData.users?.filter((u: User) => u.role === 'ADMIN').length || 0
        const now = new Date()
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const recentRegistrations = usersData.users?.filter((u: User) => 
          new Date(u.createdAt) > lastWeek
        ).length || 0
        
        setStats({
          totalUsers,
          verifiedUsers,
          adminUsers,
          recentRegistrations
        })
      } else {
        console.error('Admin verileri getirilemedi:', usersResponse.status)
      }
    } catch (error) {
      console.error('Admin verilerini getirirken hata:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('cyberly_token')
      
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        // Kullanıcı listesini güncelle
        fetchData()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Rol güncellemesi başarısız oldu')
      }
    } catch (error) {
      console.error('Rol güncellemesi hatası:', error)
      alert('Rol güncellemesi sırasında hata oluştu')
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      const token = localStorage.getItem('cyberly_token')
      
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        fetchData()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Kullanıcı silme işlemi başarısız oldu')
      }
    } catch (error) {
      console.error('Kullanıcı silme hatası:', error)
      alert('Kullanıcı silme sırasında hata oluştu')
    }
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <FaShieldAlt className="mx-auto h-12 w-12 text-cyan-500 animate-pulse mb-4" />
          <p className="text-lg">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Başlık */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <FaShieldAlt className="h-8 w-8 text-red-500 mr-3" />
            <h1 className="text-3xl font-bold text-white">Yönetim Paneli</h1>
          </div>
          <p className="text-gray-400">Sistem yönetimi ve kullanıcı kontrolü</p>
        </div>

        {/* Tab Navigasyonu */}
        <div className="mb-8">
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <FaChartBar className="inline mr-2" />
              Genel Bakış
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <FaUsers className="inline mr-2" />
              Kullanıcılar
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <FaCog className="inline mr-2" />
              Sistem Ayarları
            </button>
          </nav>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* İstatistik Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center">
                  <FaUsers className="h-8 w-8 text-cyan-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-400">Toplam Kullanıcı</p>
                    <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center">
                  <FaCheckCircle className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-400">Doğrulanmış</p>
                    <p className="text-2xl font-bold text-white">{stats.verifiedUsers}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center">
                  <FaUserShield className="h-8 w-8 text-red-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-400">Admin</p>
                    <p className="text-2xl font-bold text-white">{stats.adminUsers}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center">
                  <FaClipboard className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-400">Son 7 Gün</p>
                    <p className="text-2xl font-bold text-white">{stats.recentRegistrations}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Son Kayıtlar */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Son Kayıtlar</h3>
              <div className="space-y-3">
                {users.slice(-5).reverse().map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-md">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-white">{user.name || 'İsimsiz'}</p>
                        <p className="text-sm text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        user.role === 'ADMIN' 
                          ? 'bg-red-600 text-white' 
                          : 'bg-gray-600 text-gray-300'
                      }`}>
                        {user.role}
                      </span>
                      {user.isEmailVerified ? (
                        <FaCheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <FaExclamationTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Kullanıcı Yönetimi</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Kullanıcı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Kayıt Tarihi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {users.map((userData) => (
                    <tr key={userData.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-cyan-600 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {userData.name?.charAt(0).toUpperCase() || userData.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">{userData.name || 'İsimsiz'}</div>
                            <div className="text-sm text-gray-400">{userData.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userData.role === 'ADMIN' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {userData.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userData.isEmailVerified 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {userData.isEmailVerified ? 'Doğrulanmış' : 'Beklemede'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(userData.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <select
                            value={userData.role}
                            onChange={(e) => updateUserRole(userData.id, e.target.value)}
                            className="bg-gray-700 border border-gray-600 text-white text-xs rounded px-2 py-1"
                            disabled={userData.id === user?.id}
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                          <button
                            onClick={() => deleteUser(userData.id)}
                            disabled={userData.id === user?.id}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Sistem Ayarları</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-700 rounded-md">
                  <div>
                    <h4 className="text-white font-medium">E-posta Doğrulama</h4>
                    <p className="text-gray-400 text-sm">Yeni kullanıcıların e-posta doğrulaması yapması gereksin</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-700 rounded-md">
                  <div>
                    <h4 className="text-white font-medium">Otomatik Yedekleme</h4>
                    <p className="text-gray-400 text-sm">Veritabanının günlük yedeklemesi</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-700 rounded-md">
                  <div>
                    <h4 className="text-white font-medium">Kayıt İzni</h4>
                    <p className="text-gray-400 text-sm">Yeni kullanıcı kayıtlarına izin ver</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Tehlikeli İşlemler</h3>
              <div className="space-y-4">
                <button className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
                  Tüm Cache'leri Temizle
                </button>
                <button className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
                  Sistem Loglarını Temizle
                </button>
                <button className="w-full bg-red-700 hover:bg-red-800 text-white font-medium py-2 px-4 rounded-md transition-colors">
                  Veritabanını Yeniden Oluştur
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 