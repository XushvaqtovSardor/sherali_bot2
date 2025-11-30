import { useEffect, useState } from 'react'
import axios from 'axios'
import { Send } from 'lucide-react'

interface Settings {
  screenshotCacheDuration: string
  puppeteerConcurrency: string
  screenshotQuality: string
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [broadcast, setBroadcast] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await axios.get('/api/admin/settings')
      setSettings(response.data)
    } catch (error) {
      console.error('Failed to load settings', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSetting = async (key: string, value: string) => {
    setSaving(true)
    try {
      await axios.post('/api/admin/settings', { key, value })
      await loadSettings()
    } catch (error) {
      console.error('Failed to save setting', error)
    } finally {
      setSaving(false)
    }
  }

  const handleBroadcast = async () => {
    if (!broadcast.trim()) return
    
    setBroadcasting(true)
    try {
      const response = await axios.post('/api/admin/broadcast', { message: broadcast })
      setResult(response.data)
      setBroadcast('')
    } catch (error) {
      console.error('Failed to broadcast', error)
    } finally {
      setBroadcasting(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Broadcast Message</h2>
          <div className="space-y-4">
            <textarea
              value={broadcast}
              onChange={(e) => setBroadcast(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter message to broadcast to all users..."
            />
            <button
              onClick={handleBroadcast}
              disabled={broadcasting || !broadcast.trim()}
              className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="mr-2 h-4 w-4" />
              {broadcasting ? 'Sending...' : 'Send to All Users'}
            </button>
            {result && (
              <div className="mt-4 p-4 bg-green-50 rounded-md">
                <p className="text-sm text-green-800">
                  Successfully sent to {result.success} users. Failed: {result.failed}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cache Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Screenshot Cache Duration (ms)
              </label>
              <input
                type="number"
                value={settings?.screenshotCacheDuration}
                onChange={(e) =>
                  handleSaveSetting('screenshot_cache_duration', e.target.value)
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Puppeteer Concurrency
              </label>
              <input
                type="number"
                value={settings?.puppeteerConcurrency}
                onChange={(e) =>
                  handleSaveSetting('puppeteer_concurrency', e.target.value)
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Screenshot Quality (0-100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings?.screenshotQuality}
                onChange={(e) =>
                  handleSaveSetting('screenshot_quality', e.target.value)
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
