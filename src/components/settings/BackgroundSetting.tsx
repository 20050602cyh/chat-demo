import { useRef, useState } from 'react'
import clsx from 'clsx'
import { prepareBackground } from '../../services/background.js'
import { setChatBackground, useSettings } from '../../services/settings.js'
import { useTranslate } from '../../i18n/index.js'
import { Button } from '../base/Button.js'
import { showToast } from '../base/toastState.js'
import styles from './Settings.module.css'

/**
 * 聊天背景：从本机选一张图，等比压缩后存进 localStorage；
 * 下面一条滑块调整底色遮罩浓度，保证文字可读。
 */
export const BackgroundSetting = () => {
  const t = useTranslate()
  const background = useSettings((state) => state.chatBackground)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const choose = async (file: File) => {
    setBusy(true)
    try {
      const dataUrl = await prepareBackground(file)
      setChatBackground({ dataUrl, dim: background?.dim ?? 0.2 })
      showToast({ key: 'chatBackgroundApplied' })
    } catch {
      showToast({ key: 'chatBackgroundFailed', type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={clsx(styles.cell, styles.row)}>
        <div className={styles.text}>
          <div className={styles.label}>{t('settingsChatBackground')}</div>
          <div className={styles.description}>{t('settingsChatBackgroundDescription')}</div>
        </div>
        <div className={styles.backgroundActions}>
          <Button
            variant="outlined"
            size="m"
            className={styles.cellButton}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {t(background ? 'chatBackgroundReplace' : 'chatBackgroundChoose')}
          </Button>
          {background ? (
            <Button
              variant="outlined"
              size="m"
              className={styles.cellButton}
              disabled={busy}
              onClick={() => {
                setChatBackground(null)
                showToast({ key: 'chatBackgroundReset' })
              }}
            >
              {t('chatBackgroundResetAction')}
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) {
              void choose(file)
            }
          }}
        />
      </div>
      {background ? (
        <div className={styles.backgroundPreview}>
          <div
            className={styles.backgroundThumb}
            style={{ backgroundImage: `url(${background.dataUrl})` }}
          />
          <label className={styles.backgroundSlider}>
            <span className={styles.backgroundSliderLabel}>
              {t('chatBackgroundDim', { value: Math.round(background.dim * 100) })}
            </span>
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={Math.round(background.dim * 100)}
              onChange={(event) => {
                const dim = Number(event.target.value) / 100
                setChatBackground({ dataUrl: background.dataUrl, dim })
              }}
            />
          </label>
        </div>
      ) : null}
    </>
  )
}
