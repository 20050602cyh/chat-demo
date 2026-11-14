import { useState } from 'react'
import clsx from 'clsx'
import {
  addMemory,
  clearMemories,
  MEMORY_LIMITS,
  removeMemory,
  setMemoryEnabled,
  useSettings,
  type MemoryEntry,
} from '../../services/settings.js'
import { useTranslate } from '../../i18n/index.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { IconMemoryOutline16, IconTrashOutline16 } from '../base/icons.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import styles from './Settings.module.css'

/**
 * 记忆设置：开关、手工添加、逐条删除、清空。
 * 记忆只写在本机 localStorage，每次请求时拼进系统提示。
 */
export const MemorySetting = () => {
  const t = useTranslate()
  const memoryEnabled = useSettings((state) => state.memoryEnabled)
  const memories = useSettings((state) => state.memories)
  const [draft, setDraft] = useState('')
  const [clearing, setClearing] = useState(false)
  const full = memories.length >= MEMORY_LIMITS.entries

  const submit = () => {
    const result = addMemory(draft)
    if (result === 'added') {
      setDraft('')
      showToast({ key: 'memorySaved' })
      return
    }
    showToast({ key: result === 'full' ? 'memoryFull' : 'memoryAlreadySaved' })
  }

  return (
    <>
      <div className={clsx(styles.cell, styles.row)}>
        <div className={styles.text}>
          <div className={styles.label}>{t('settingsMemory')}</div>
          <div className={styles.description}>{t('settingsMemoryDescription')}</div>
        </div>
        <Button
          variant="outlined"
          size="m"
          className={styles.cellButton}
          onClick={() => setMemoryEnabled(!memoryEnabled)}
        >
          {t(memoryEnabled ? 'settingsMemoryOn' : 'settingsMemoryOff')}
        </Button>
      </div>
      <div className={styles.memoryEditor}>
        <textarea
          className={styles.memoryTextarea}
          value={draft}
          rows={3}
          maxLength={MEMORY_LIMITS.chars}
          placeholder={t('settingsMemoryPlaceholder')}
          disabled={!memoryEnabled || full}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <div className={styles.memoryEditorFooter}>
          <span className={styles.memoryCount}>
            {t('settingsMemoryCount', {
              count: memories.length,
              limit: MEMORY_LIMITS.entries,
            })}
          </span>
          <Button
            size="s"
            className={styles.cellButton}
            disabled={!memoryEnabled || full || !draft.trim()}
            onClick={submit}
          >
            {t('settingsMemoryAdd')}
          </Button>
        </div>
      </div>
      {memories.length === 0 ? (
        <div className={styles.memoryEmpty}>
          <IconMemoryOutline16 />
          {t('settingsMemoryEmpty')}
        </div>
      ) : (
        <ul className={styles.memoryList}>
          {memories.map((item) => (
            <MemoryItem key={item.id} item={item} disabled={!memoryEnabled} />
          ))}
        </ul>
      )}
      {memories.length > 0 ? (
        <div className={styles.memoryFooter}>
          <Button size="s" variant="dangerOutlined" onClick={() => setClearing(true)}>
            {t('settingsMemoryClear')}
          </Button>
        </div>
      ) : null}
      {clearing ? (
        <Modal
          title={t('settingsMemoryClearTitle')}
          className={styles.deleteConfirm}
          onClose={() => setClearing(false)}
          footer={
            <div className={styles.deleteActions}>
              <Button variant="outlined" autoFocus onClick={() => setClearing(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  clearMemories()
                  setClearing(false)
                  showToast({ key: 'settingsMemoryCleared' })
                }}
              >
                {t('settingsMemoryClear')}
              </Button>
            </div>
          }
        >
          {t('settingsMemoryClearDescription')}
        </Modal>
      ) : null}
    </>
  )
}

const MemoryItem = ({ item, disabled }: { item: MemoryEntry; disabled: boolean }) => {
  const t = useTranslate()
  return (
    <li className={styles.memoryItem}>
      <div className={styles.memoryText}>{item.text}</div>
      <IconButton
        icon={<IconTrashOutline16 />}
        tooltip={t('delete')}
        tooltipPlacement="bottom"
        disabled={disabled}
        onClick={() => removeMemory(item.id)}
      />
    </li>
  )
}
