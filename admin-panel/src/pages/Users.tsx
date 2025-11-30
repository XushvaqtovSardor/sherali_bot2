import { useEffect, useState } from 'react'
import axios from 'axios'
import { Search } from 'lucide-react'

interface User {
  id: number
  telegramId: string
  firstName: string
  lastName: string
  lastChoice: any
  createdAt: string
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ fakultet: '', kurs: '', guruh: '' })

  useEffect(() => {
    loadUsers()
  }, [filters])

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.fakultet) params.append('fakultet', filters.fakultet)
      if (filters.kurs) params.append('kurs', filters.kurs)
      if (filters.guruh) params.append('guruh', filters.guruh)
      
      const response = await axios.get(`/api/admin/users?${params}`)
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to load users', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter((user) => {
    const searchLower = search.toLowerCase()
    return (
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.telegramId?.toString().includes(searchLower)
    )
  })

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Users</h1>

      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={filters.fakultet}
            onChange={(e) => setFilters({ ...filters, fakultet: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Fakultet</option>
            <option value="Pedagogika">Pedagogika</option>
            <option value="Filologiya">Filologiya</option>
            <option value="Tarix">Tarix</option>
            <option value="Matematika">Matematika</option>
          </select>
          <select
            value={filters.kurs}
            onChange={(e) => setFilters({ ...filters, kurs: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Kurs</option>
            <option value="1">1-kurs</option>
            <option value="2">2-kurs</option>
            <option value="3">3-kurs</option>
            <option value="4">4-kurs</option>
          </select>
          <select
            value={filters.guruh}
            onChange={(e) => setFilters({ ...filters, guruh: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Guruh</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(g => (
              <option key={g} value={g}>{g}-guruh</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Telegram ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Choice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.telegramId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastChoice ? (
                    <span>
                      {user.lastChoice.fakultet} - {user.lastChoice.kurs} - {user.lastChoice.guruh}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
