import { create } from 'zustand'
import type { TtsVoice } from './api/speech.js'
import { normalizeLocation, type UserLocation } from './location.js'
import { createId } from '../utils/id.js'

export type Locale = 'zh-CN' | 'en-US'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** 一条长期记忆：文本随每次请求放进系统提示，只保存在本机 */
export type MemoryEntry = {
  id: string
  text: string
  createdAt: number
}

/** 自定义聊天背景：图片以 data URL 存本机，dim 为底色遮罩不透明度（0–0.8） */
export type ChatBackground = { dataUrl: string; dim: number }

/** 记忆条目上限与单条长度上限，避免系统提示无限膨胀 */
export const MEMORY_LIMITS = { entries: 100, chars: 600 } as const

/** 本机设置，存 localStorage：API Key、语言、主题、位置、朗读音色、深度思考与智能搜索开关、侧边栏收起状态、记忆 */
type Settings = {
  apiKey: string | null
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  ttsVoice: TtsVoice
  thinking: boolean
  search: boolean
  siderCollapsed: boolean
  memoryEnabled: boolean
  memories: MemoryEntry[]
  chatBackground: ChatBackground | null
}

const KEYS = {
  apiKey: 'chat-demo:api-key',
  locale: 'chat-demo:locale',
  location: 'chat-demo:location',
  themePreference: 'chat-demo:theme-preference',
  ttsVoice: 'chat-demo:tts-voice',
  thinking: 'chat-demo:thinking',
  search: 'chat-demo:search',
  siderCollapsed: 'chat-demo:sider-collapsed',
  memoryEnabled: 'chat-demo:memory-enabled',
  memories: 'chat-demo:memories',
  chatBackground: 'chat-demo:chat-background',
} as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 位置选择模式跟随浏览器语言，与应用内选择的界面语言无关。 */
export const isChineseBrowser = (): boolean =>
  (typeof navigator === 'undefined' ? 'zh' : navigator.language).toLowerCase().startsWith('zh')

const initialLocale = (): Locale => {
  const saved = read(KEYS.locale)
  if (saved === 'zh-CN' || saved === 'en-US') {
    return saved
  }
  return isChineseBrowser() ? 'zh-CN' : 'en-US'
}

const initialLocation = (): UserLocation | null => {
  try {
    const location = normalizeLocation(JSON.parse(read(KEYS.location) ?? 'null'))
    if (!location) {
      return null
    }
    return isChineseBrowser()
      ? location.region === 'CN' && location.province
        ? location
        : null
      : { region: location.region }
  } catch {
    return null
  }
}

/** 未保存过时跟随系统 */
const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

/** 未保存过时使用服务端默认音色 stella（海星） */
const initialTtsVoice = (): TtsVoice => (read(KEYS.ttsVoice) === 'tide' ? 'tide' : 'stella')

/** 读取记忆：脏数据整条丢弃，超长文本截断，条数按上限裁剪 */
const initialMemories = (): MemoryEntry[] => {
  try {
    const raw: unknown = JSON.parse(read(KEYS.memories) ?? '[]')
    if (!Array.isArray(raw)) {
      return []
    }
    return raw
      .flatMap((item): MemoryEntry[] => {
        if (typeof item !== 'object' || item === null) {
          return []
        }
        const { id, text, createdAt } = item as Partial<MemoryEntry>
        if (typeof text !== 'string' || !text.trim()) {
          return []
        }
        return [
          {
            id: typeof id === 'string' && id ? id : createId(),
            text: text.slice(0, MEMORY_LIMITS.chars),
            createdAt: typeof createdAt === 'number' ? createdAt : Date.now(),
          },
        ]
      })
      .slice(0, MEMORY_LIMITS.entries)
  } catch {
    return []
  }
}

/** 读取背景：只接受 data:image 开头的图片，遮罩浓度裁剪到 0–0.8 */
const initialChatBackground = (): ChatBackground | null => {
  try {
    const raw: unknown = JSON.parse(read(KEYS.chatBackground) ?? 'null')
    if (typeof raw !== 'object' || raw === null) {
      return null
    }
    const { dataUrl, dim } = raw as Partial<ChatBackground>
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return null
    }
    const opacity = typeof dim === 'number' && Number.isFinite(dim) ? dim : 0.2
    return { dataUrl, dim: Math.min(0.8, Math.max(0, opacity)) }
  } catch {
    return null
  }
}

/** 保存后同步到 store，界面立即刷新 */
const saveMemories = (memories: MemoryEntry[]) => {
  write(KEYS.memories, JSON.stringify(memories))
  useSettings.setState({ memories })
}

export type AddMemoryResult = 'added' | 'duplicate' | 'full'

/** 添加一条记忆；相同文本不重复记录，超过条数上限时返回 full */
export const addMemory = (text: string): AddMemoryResult => {
  const trimmed = text.trim().slice(0, MEMORY_LIMITS.chars)
  if (!trimmed) {
    return 'duplicate'
  }
  const { memories } = useSettings.getState()
  if (memories.some((item) => item.text === trimmed)) {
    return 'duplicate'
  }
  if (memories.length >= MEMORY_LIMITS.entries) {
    return 'full'
  }
  saveMemories([{ id: createId(), text: trimmed, createdAt: Date.now() }, ...memories])
  return 'added'
}

export const removeMemory = (id: string) => {
  saveMemories(useSettings.getState().memories.filter((item) => item.id !== id))
}

export const clearMemories = () => saveMemories([])

/** 导入历史时用具名文本覆盖记忆，重新生成 id，去重并截断 */
export const replaceMemories = (texts: string[]) => {
  const seen = new Set<string>()
  const memories: MemoryEntry[] = []
  for (const text of texts) {
    const trimmed = text.trim().slice(0, MEMORY_LIMITS.chars)
    if (!trimmed || seen.has(trimmed) || memories.length >= MEMORY_LIMITS.entries) {
      continue
    }
    seen.add(trimmed)
    memories.push({ id: createId(), text: trimmed, createdAt: Date.now() })
  }
  saveMemories(memories)
}

export const setChatBackground = (chatBackground: ChatBackground | null) => {
  write(KEYS.chatBackground, chatBackground ? JSON.stringify(chatBackground) : null)
  useSettings.setState({ chatBackground })
}

export const setMemoryEnabled = (memoryEnabled: boolean) => {
  write(KEYS.memoryEnabled, String(memoryEnabled))
  useSettings.setState({ memoryEnabled })
}

export const useSettings = create<Settings>(() => ({
  apiKey: read(KEYS.apiKey),
  locale: initialLocale(),
  location: initialLocation(),
  themePreference: initialThemePreference(),
  ttsVoice: initialTtsVoice(),
  thinking: read(KEYS.thinking) === 'true',
  search: read(KEYS.search) === 'true',
  siderCollapsed: read(KEYS.siderCollapsed) === 'true',
  memoryEnabled: read(KEYS.memoryEnabled) !== 'false',
  memories: initialMemories(),
  chatBackground: initialChatBackground(),
}))

export const setLocale = (locale: Locale) => {
  write(KEYS.locale, locale)
  useSettings.setState({ locale })
}

export const setLocation = (value: UserLocation | null) => {
  const location = normalizeLocation(value)
  write(KEYS.location, location ? JSON.stringify(location) : null)
  useSettings.setState({ location })
}

export const setThemePreference = (themePreference: ThemePreference) => {
  write(KEYS.themePreference, themePreference)
  useSettings.setState({ themePreference })
}

export const setTtsVoice = (ttsVoice: TtsVoice) => {
  write(KEYS.ttsVoice, ttsVoice)
  useSettings.setState({ ttsVoice })
}

export const setApiKey = (apiKey: string | null) => {
  write(KEYS.apiKey, apiKey)
  useSettings.setState({ apiKey })
}

export const setThinking = (thinking: boolean) => {
  write(KEYS.thinking, String(thinking))
  useSettings.setState({ thinking })
}

export const setSearch = (search: boolean) => {
  write(KEYS.search, String(search))
  useSettings.setState({ search })
}

export const setSiderCollapsed = (siderCollapsed: boolean) => {
  write(KEYS.siderCollapsed, String(siderCollapsed))
  useSettings.setState({ siderCollapsed })
}
