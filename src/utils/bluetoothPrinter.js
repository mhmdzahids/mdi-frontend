/**
 * Web Bluetooth API Manager untuk Thermal POS Printer (ESC/POS)
 * Kompatibel dengan Printer 80mm Bluetooth (Putian POS, Xprinter, GOOJPRT, dll.)
 */

// UUID Service & Karakteristik yang umum digunakan printer thermal POS / Label BLE
const COMMON_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Serial SPP over BLE (Paling Populer)
  '0000fff0-0000-1000-8000-00805f9b34fb', // Custom UART POS
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Vendor Thermal POS
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic Vendor UART
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / WeChat BLE Printer
  '0000fef5-0000-1000-8000-00805f9b34fb', // Dialog BLE
  '0000ae30-0000-1000-8000-00805f9b34fb', // Microchip / POS
  '0000ae00-0000-1000-8000-00805f9b34fb', // ZJiang POS
  '0000fe00-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
  '0000ff12-0000-1000-8000-00805f9b34fb',
  '0000ffb0-0000-1000-8000-00805f9b34fb',
  '0000aa80-0000-1000-8000-00805f9b34fb',
  'd973f2e0-b19e-11e2-9e96-0800200c9a66',
  '0000fd00-0000-1000-8000-00805f9b34fb',
  '000018f1-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000fff1-0000-1000-8000-00805f9b34fb'
]

class BluetoothPrinterService {
  constructor() {
    this.device = null
    this.server = null
    this.characteristic = null
    this.statusListeners = new Set()
    this.isPrinting = false
    this.status = 'DISCONNECTED' // 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
    this.deviceName = ''
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  subscribe(listener) {
    this.statusListeners.add(listener)
    listener({
      status: this.status,
      deviceName: this.deviceName,
      isPrinting: this.isPrinting
    })
    return () => this.statusListeners.delete(listener)
  }

  notify(extra = {}) {
    const payload = {
      status: this.status,
      deviceName: this.deviceName,
      isPrinting: this.isPrinting,
      ...extra
    }
    this.statusListeners.forEach((fn) => fn(payload))
  }

  /**
   * Cari dan sambungkan ke Printer Bluetooth via Web Bluetooth API
   */
  async connect() {
    if (!this.isSupported()) {
      const errMsg = 'Browser Anda tidak mendukung Web Bluetooth API. Gunakan Google Chrome di Android atau PC.'
      this.status = 'ERROR'
      this.notify({ error: errMsg })
      throw new Error(errMsg)
    }

    try {
      this.status = 'CONNECTING'
      this.notify()

      // Minta izin akses perangkat bluetooth dengan filter dan optionalServices printer
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: COMMON_PRINTER_SERVICES
      })

      this.device = device
      this.deviceName = device.name || 'Bluetooth Printer'

      device.addEventListener('gattserverdisconnected', () => {
        this.status = 'DISCONNECTED'
        this.characteristic = null
        this.server = null
        this.isPrinting = false
        this.notify()
      })

      // Sambungkan ke GATT Server
      const server = await device.gatt.connect()
      this.server = server

      // Beri jeda kecil agar handshake GATT BLE stabil di Windows/Android
      await new Promise((resolve) => setTimeout(resolve, 150))

      if (!server.connected) {
        throw new Error('Koneksi GATT ke printer terputus saat inisialisasi.')
      }

      // Cari characteristic yang memiliki properti write
      let targetChar = null

      for (const serviceUuid of COMMON_PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid)
          const characteristics = await service.getCharacteristics()
          
          for (const c of characteristics) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              targetChar = c
              break
            }
          }
          if (targetChar) break
        } catch {
          // Lanjutkan jika service tertentu tidak didukung oleh printer ini
        }
      }

      // Jika belum ketemu dari list umum, scan seluruh primary service yang tersedia
      if (!targetChar) {
        try {
          const services = await server.getPrimaryServices()
          for (const s of services) {
            try {
              const chars = await s.getCharacteristics()
              for (const c of chars) {
                if (c.properties.write || c.properties.writeWithoutResponse) {
                  targetChar = c
                  break
                }
              }
              if (targetChar) break
            } catch {
              // Abaikan per-service error
            }
          }
        } catch {
          // Abaikan
        }
      }

      if (!targetChar) {
        throw new Error('Karakteristik penulisan printer tidak ditemukan. Pastikan printer sedang menyala, tidak sedang terhubung ke aplikasi OpenLabel / ponsel lain, dan pilih nama printer yang tepat.')
      }

      this.characteristic = targetChar
      this.status = 'CONNECTED'
      this.notify()
      return true
    } catch (err) {
      this.status = 'DISCONNECTED'
      this.characteristic = null
      this.server = null
      this.notify({ error: err.message })
      throw err
    }
  }

  /**
   * Putuskan koneksi Bluetooth
   */
  disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect()
    }
    this.status = 'DISCONNECTED'
    this.characteristic = null
    this.server = null
    this.isPrinting = false
    this.notify()
  }

  resetState() {
    this.isPrinting = false
    this.notify()
  }

  /**
   * Kirim buffer biner ESC/POS secara chunking agar tidak buffer overflow
   * @param {Uint8Array} dataBuffer 
   * @param {Function} onProgress 
   */
  async print(dataBuffer, onProgress) {
    if (!this.characteristic || !this.server || !this.server.connected) {
      this.isPrinting = false
      this.notify()
      throw new Error('Printer belum terhubung via Bluetooth.')
    }

    this.isPrinting = true
    this.notify()

    try {
      const CHUNK_SIZE = 80 // Ukuran aman BLE MTU untuk thermal printer murah
      const totalBytes = dataBuffer.length
      let offset = 0

      while (offset < totalBytes) {
        const slice = dataBuffer.slice(offset, offset + CHUNK_SIZE)
        
        const writePromise = this.characteristic.properties.writeWithoutResponse
          ? this.characteristic.writeValueWithoutResponse(slice)
          : this.characteristic.writeValueWithResponse(slice)

        // Timeout 4 detik per chunk agar tidak pernah freeze UI jika printer tidak merespons
        await Promise.race([
          writePromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Koneksi Bluetooth printer timeout.')), 4000)
          )
        ])

        offset += slice.length
        if (onProgress) {
          onProgress(Math.min(100, Math.round((offset / totalBytes) * 100)))
        }

        // Jeda 18ms per paket agar mikrokontroler printer tidak freeze
        await new Promise((r) => setTimeout(r, 18))
      }

      return true
    } catch (err) {
      console.error('Bluetooth print error:', err)
      throw err
    } finally {
      this.isPrinting = false
      this.notify()
    }
  }

  /**
   * Uji Beep Printer (ESC B 3 2)
   */
  async sendBeep() {
    const beepCmd = new Uint8Array([0x1B, 0x42, 0x02, 0x02]) // Beep 2x
    await this.print(beepCmd)
  }

  /**
   * Tarik Kertas / Feed (ESC d n)
   */
  async sendFeed(lines = 3) {
    const feedCmd = new Uint8Array([0x1B, 0x64, lines])
    await this.print(feedCmd)
  }

  /**
   * Tarik Kertas berdasarkan dots (ESC J n)
   * 8 dots = 1 mm pada printer 203 DPI
   */
  async sendFeedDots(dots = 16) {
    const feedCmd = new Uint8Array([0x1B, 0x4A, Math.min(255, Math.max(1, Math.round(dots)))])
    await this.print(feedCmd)
  }
}

export const bluetoothPrinter = new BluetoothPrinterService()
