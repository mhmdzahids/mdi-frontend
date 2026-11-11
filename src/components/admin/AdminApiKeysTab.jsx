import { useState, useEffect } from 'react'
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react'
import { apiGet, apiPost, apiDelete } from '../../utils/api'

export default function AdminApiKeysTab() {
  const [keys, setKeys] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchKeys = async () => {
    try {
      setIsLoading(true)
      const data = await apiGet('/pos/api-keys')
      setKeys(data || [])
    } catch (err) {
      console.error('Failed to load API keys:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    apiGet('/pos/api-keys')
      .then((data) => {
        if (isMounted) setKeys(data || [])
      })
      .catch((err) => console.error('Failed to load API keys:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const handleCreateKey = async (e) => {
    e.preventDefault()
    if (!keyName.trim()) return

    setIsSubmitting(true)
    try {
      const res = await apiPost('/pos/api-keys', { name: keyName.trim() })
      setCreatedKey(res.api_key)
      setKeyName('')
      fetchKeys()
    } catch (err) {
      alert(err?.message || 'Gagal membuat API Key.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevokeKey = async (k) => {
    if (!window.confirm(`Cabut API Key '${k.name}'? Website yang menggunakan token ini tidak dapat mengirim pesanan lagi.`)) {
      return
    }

    try {
      await apiDelete(`/pos/api-keys/${k.id}`)
      fetchKeys()
    } catch (err) {
      alert(err?.message || 'Gagal mencabut API Key.')
    }
  }

  const handleCopy = () => {
    if (!createdKey) return
    navigator.clipboard.writeText(createdKey)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <div className="space-y-3.5 select-none">
      {/* Header & Tombol Tambah */}
      <div className="flex items-center justify-between px-1">
        <div>
          <span className="text-xs font-bold text-[#2C3E50] block">
            API Key Integrasi Website
          </span>
          <span className="text-[11px] text-[#6B7B8D]">
            Hubungkan website e-commerce luar untuk kirim pesanan otomatis ke POS
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreatedKey(null)
            setIsModalOpen(true)
          }}
          className="h-9 px-3 rounded-xl bg-[#2F7D5B] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#27664B] active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Key</span>
        </button>
      </div>

      {/* List API Keys */}
      {isLoading ? (
        <div className="text-center py-8 text-xs text-[#6B7B8D]">Memuat API Keys...</div>
      ) : keys.length === 0 ? (
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-[#6B7B8D]">
          <Key className="w-8 h-8 mx-auto text-[#B7C3CE] mb-2 stroke-[1.5]" />
          <span className="text-xs font-bold block text-[#2C3E50]">Belum ada API Key</span>
          <span className="text-[11px] block mt-0.5">
            Klik tombol "Buat Key" di atas untuk menghubungkan website toko luar Anda.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="bg-white border border-[#EDE8DF] rounded-2xl p-3.5 shadow-2xs flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#2C3E50]">{k.name}</span>
                  <span className="text-[10px] font-mono bg-[#F5F1EB] px-2 py-0.5 rounded text-[#6B7B8D]">
                    {k.key_prefix}
                  </span>
                </div>
                <div className="text-[10px] text-[#6B7B8D]">
                  Dibuat {new Date(k.created_at).toLocaleDateString('id-ID')}
                  {k.last_used_at && ` • Terakhir dipakai ${new Date(k.last_used_at).toLocaleDateString('id-ID')}`}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRevokeKey(k)}
                className="w-9 h-9 rounded-xl border border-rose-200 text-rose-600 flex items-center justify-center hover:bg-rose-50 active:scale-95 cursor-pointer"
                title="Cabut API Key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Buat API Key */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-[#EDE8DF] space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-3">
              <span className="text-sm font-bold text-[#2C3E50]">
                {createdKey ? 'API Key Baru Dibuat' : 'Buat API Key Website'}
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#6B7B8D] hover:text-[#2C3E50] text-sm"
              >
                ✕
              </button>
            </div>

            {createdKey ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <span className="font-bold block">Penting: Salin sekarang!</span>
                  <span>Token ini hanya ditampilkan satu kali dan tidak bisa dibuka lagi demi keamanan.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#6B7B8D] block">Token Rahasia</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdKey}
                      className="flex-1 h-11 bg-[#F5F1EB] border border-[#B7C3CE] rounded-xl px-3 font-mono text-xs text-[#2C3E50]"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="h-11 px-3.5 rounded-xl bg-[#2F7D5B] text-white text-xs font-bold flex items-center gap-1 active:scale-95"
                    >
                      {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                </div>

                {/* Dokumentasi Singkat Developer */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-[#6B7B8D] block">
                    Cara Pakai di Website Anda (Endpoint Webhook):
                  </span>
                  <pre className="p-2.5 bg-[#2C3E50] text-[#EDE8DF] rounded-xl text-[10px] font-mono overflow-x-auto leading-relaxed">
{`POST /api/v1/pos/external-orders
Header:
  X-API-Key: ${createdKey.slice(0, 16)}...
Body (JSON):
  {
    "external_order_id": "WEB-1042",
    "customer_name": "Ibu Ratna",
    "items": [{"product_id": "FG_MIKA", "qty": 2}]
  }`}
                  </pre>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full h-11 rounded-xl bg-[#2C3E50] text-white text-xs font-bold active:scale-98"
                >
                  Selesai
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#6B7B8D] block">Nama Integrasi</label>
                  <input
                    type="text"
                    required
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="Contoh: Website Toko Dimsum"
                    className="w-full h-11 bg-white border border-[#B7C3CE] rounded-xl px-3 text-xs text-[#2C3E50] focus:outline-none focus:border-[#4685ac]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !keyName.trim()}
                  className="w-full h-11 rounded-xl bg-[#2F7D5B] text-white text-xs font-bold active:scale-98 disabled:opacity-40"
                >
                  {isSubmitting ? 'Membuat...' : 'Buat Token'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
