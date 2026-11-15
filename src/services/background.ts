/**
 * 聊天背景图处理：读入本机图片，等比缩到最长边上限后转成 JPEG data URL。
 * 背景图存在 localStorage 里，所以失败时逐级降分辨率再试。
 */

/** 单张背景 data URL 的字符上限；localStorage 通常只有 5MB 左右 */
export const BACKGROUND_SIZE_LIMIT = 2_400_000

/** 依次尝试的压缩档位：先保证清晰度，存不下再降 */
const ATTEMPTS = [
  { maxEdge: 1600, quality: 0.86 },
  { maxEdge: 1280, quality: 0.72 },
  { maxEdge: 960, quality: 0.6 },
] as const

type Loaded = { source: CanvasImageSource; width: number; height: number; release: () => void }

/** 优先用 createImageBitmap；不支持或解码失败时退回 <img> */
const loadImage = async (file: File): Promise<Loaded> => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      // 继续用 <img> 解码
    }
  }
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.src = url
  try {
    await image.decode()
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  }
}

const toDataUrl = (
  { source, width, height }: Loaded,
  maxEdge: number,
  quality: number
): string => {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('canvas 2d context unavailable')
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/** 处理成可直接存本机的背景；所有档位都超过上限时抛错，由调用方提示换图 */
export const prepareBackground = async (file: File): Promise<string> => {
  const loaded = await loadImage(file)
  try {
    let smallest = ''
    for (const attempt of ATTEMPTS) {
      const dataUrl = toDataUrl(loaded, attempt.maxEdge, attempt.quality)
      if (dataUrl.length <= BACKGROUND_SIZE_LIMIT) {
        return dataUrl
      }
      smallest = dataUrl
    }
    if (smallest) {
      throw new Error('background too large')
    }
    throw new Error('background encoding failed')
  } finally {
    loaded.release()
  }
}
