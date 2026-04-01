/**
 * ブラウザ上で画像をリサイズ・圧縮する
 * Vercel Serverless のボディサイズ制限（4.5MB）に収めるため
 */

const MAX_WIDTH = 1600
const MAX_HEIGHT = 1600
const QUALITY = 0.8
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

export async function compressImage(file: File): Promise<File> {
  // 画像ファイルでなければそのまま返す
  if (!file.type.startsWith('image/')) return file

  // 2MB以下ならそのまま
  if (file.size <= MAX_FILE_SIZE) return file

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img

      // アスペクト比を維持してリサイズ
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file) // Canvas使えなければ元ファイル
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file) // 圧縮後の方が大きければ元ファイル
            return
          }
          const compressed = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          resolve(compressed)
        },
        'image/jpeg',
        QUALITY
      )
    }

    img.onerror = () => resolve(file)

    const url = URL.createObjectURL(file)
    img.src = url
  })
}
