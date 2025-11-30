import { useEffect, useState } from 'react'
import axios from 'axios'
import { RefreshCw } from 'lucide-react'

interface CacheItem {
  id: number
  fakultet: string
  kurs: string
  guruh: string
  screenshotPath: string
  createdAt: string
  expiresAt: string
}

export default function Cache() {
  const [cache, setCache] = useState<CacheItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<number | null>(null)

  useEffect(() => {
    loadCache()
  }, [])

  const loadCache = async () => {
    try {
      const response = await axios.get('/api/admin/cache')
      setCache(response.data)
    } catch (error) {
      console.error('Failed to load cache', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async (item: CacheItem) => {
    setRefreshing(item.id)
    try {
      await axios.post('/api/admin/refresh-screenshot', {
        fakultet: item.fakultet,
        kurs: item.kurs,
        guruh: item.guruh,
      })
      await loadCache()
    } catch (error) {
      console.error('Failed to refresh screenshot', error)
    } finally {
      setRefreshing(null)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Screenshot Cache</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cache.map((item) => (
          <div key={item.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="aspect-video bg-gray-200">
              <img
                src={item.screenshotPath}
                alt={`${item.fakultet} ${item.kurs} ${item.guruh}`}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900">
                {item.fakultet} - {item.kurs}-kurs - {item.guruh}-guruh
              </h3>
              <div className="mt-2 text-sm text-gray-500">
                <p>Created: {new Date(item.createdAt).toLocaleString()}</p>
                <p>Expires: {new Date(item.expiresAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => handleRefresh(item)}
                disabled={refreshing === item.id}
                className="mt-4 w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing === item.id ? 'animate-spin' : ''}`} />
                {refreshing === item.id ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {cache.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No cached screenshots found</p>
        </div>
      )}
    </div>
  )
}
