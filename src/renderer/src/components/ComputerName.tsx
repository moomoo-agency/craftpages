import { useEffect, useState } from 'react'
import { Field } from './Field'
import { useT } from '../i18n'

/** This computer's name in sync and publish history; saved when the field is left. */
export default function ComputerName(): React.JSX.Element {
  const t = useT()
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState('')
  useEffect(() => {
    window.api.getAppSettings().then((settings) => {
      setValue(settings.computerName ?? '')
      setSaved(settings.computerName ?? '')
    })
  }, [])
  const save = async (): Promise<void> => {
    if (value.trim() === saved) return
    const next = await window.api.saveAppSettings({ computerName: value })
    setValue(next.computerName)
    setSaved(next.computerName)
  }
  return (
    <div className="computer-name">
      <Field label={t('sync.computerName')} hint={t('sync.computerNameHint')}>
        <input
          value={value}
          maxLength={60}
          placeholder={t('sync.computerNamePlaceholder')}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </Field>
    </div>
  )
}
