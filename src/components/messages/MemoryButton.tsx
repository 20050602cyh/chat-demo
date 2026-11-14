import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { addMemory } from '../../services/settings.js'
import { IconButton } from '../base/IconButton.js'
import { IconCheckOutline16, IconMemoryOutline16 } from '../base/icons.js'
import { showToast } from '../base/toastState.js'

/** 把这条消息存进长期记忆；存好后图标换成对勾 1 秒 */
export const MemoryButton = ({ text }: { text: string }) => {
  const t = useTranslate()
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <IconButton
      icon={saved ? <IconCheckOutline16 /> : <IconMemoryOutline16 />}
      tooltip={t('rememberThis')}
      tooltipPlacement="bottom"
      onClick={() => {
        const result = addMemory(text)
        if (result === 'added') {
          setSaved(true)
          timerRef.current = setTimeout(() => setSaved(false), 1000)
        }
        showToast({
          key:
            result === 'added'
              ? 'memorySaved'
              : result === 'full'
                ? 'memoryFull'
                : 'memoryAlreadySaved',
        })
      }}
    />
  )
}
