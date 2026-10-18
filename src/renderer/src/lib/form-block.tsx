/* eslint-disable react-refresh/only-export-components -- block edit/save components are registered imperatively, not rendered by module */
import { useEffect, useState } from 'react'
import { InspectorControls, useBlockProps } from '@wordpress/block-editor'
import { registerBlockType } from '@wordpress/blocks'
import { Button, Notice, PanelBody, Placeholder, SelectControl } from '@wordpress/components'
import { RawHTML } from '@wordpress/element'
import { envelope } from '@wordpress/icons'
import { translate, useT } from '../i18n'
import { errorMessage } from './api'
import { embedSnippet } from '../../../shared/forms'
import type { FormsList, FormsProject } from '../../../shared/types'

/**
 * A CraftForms form in a post (unfinished/CRAFTFORMS.md). Saves exactly the
 * snippet the CraftForms dashboard gives out, so the generated page carries it
 * like any hand-pasted one, and the Forms view lists it. The key and loader are
 * read back from that markup; the form's title and website are kept in the
 * block comment only to label it in the editor.
 */

export const FORM_BLOCK = 'craftpages/form'

interface FormAttributes {
  key: string
  loaderUrl: string
  formId: string
  title: string
  domain: string
}

type SetAttributes = (next: Partial<FormAttributes>) => void

function FormEdit({
  attributes: a,
  setAttributes
}: {
  attributes: FormAttributes
  setAttributes: SetAttributes
}): React.JSX.Element {
  const t = useT()
  const [project, setProject] = useState<FormsProject | null>(null)
  const [list, setList] = useState<FormsList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    window.api.formsProject().then(
      async (next) => {
        if (!live) return
        setProject(next)
        if (!next.account || !next.domain) return
        try {
          const found = await window.api.formsList(next.domain)
          if (live) setList(found)
        } catch (e) {
          if (live) setError(errorMessage(e))
        }
      },
      (e) => live && setError(errorMessage(e))
    )
    return () => {
      live = false
    }
  }, [])

  const domain = project?.domain ?? ''
  const websites = list?.quota.websites
  const lastSlot =
    list?.requested?.status === 'available' &&
    !!websites &&
    websites.limit > 0 &&
    websites.used + 1 >= websites.limit

  const choose = async (formId: string, confirmed = false): Promise<void> => {
    if (!formId || !list) return
    if (!confirmed && !list.requested?.keys[formId] && lastSlot) {
      setPending(formId)
      return
    }
    setPending(null)
    setBusy(true)
    setError(null)
    try {
      const ensured = await window.api.ensureFormEmbed(formId, domain)
      const form = list.forms.find((f) => f.id === formId)
      setAttributes({
        key: ensured.key,
        loaderUrl: list.loaderUrl,
        formId,
        title: form?.title ?? '',
        domain: ensured.domain
      })
      if (ensured.created) setList(await window.api.formsList(domain))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const options = [
    { value: '', label: t('post.formChoose') },
    ...(list?.forms ?? [])
      .filter((form) => form.embeddable)
      .map((form) => ({ value: form.id, label: form.title }))
  ]
  const picker = (
    <>
      {project && !project.account && <p>{t('post.formNoAccount')}</p>}
      {project?.account && !domain && <p>{t('post.formNoWebsite')}</p>}
      {list && (
        <SelectControl
          label={t('post.formLabel')}
          value={a.formId}
          options={options}
          disabled={busy || list.requested?.status === 'over_limit'}
          onChange={(value: string) => void choose(value)}
          __nextHasNoMarginBottom
        />
      )}
      {list?.requested?.status === 'over_limit' && (
        <Notice status="warning" isDismissible={false}>
          {t('forms.statusOver', { domain })}
        </Notice>
      )}
      {pending && (
        <Notice status="warning" isDismissible={false}>
          {t('forms.confirmLast', { domain })}{' '}
          <Button variant="primary" onClick={() => void choose(pending, true)}>
            {t('forms.confirmYes')}
          </Button>{' '}
          <Button variant="tertiary" onClick={() => setPending(null)}>
            {t('common.cancel')}
          </Button>
        </Notice>
      )}
      {error && (
        <Notice status="error" isDismissible={false}>
          {error}
        </Notice>
      )}
    </>
  )

  const blockProps = useBlockProps({ className: 'cp-form-block' })
  if (!a.key) {
    return (
      <div {...blockProps}>
        <Placeholder
          icon={envelope}
          label={t('post.formTitle')}
          instructions={t('post.formInstructions')}
        >
          <div className="cp-form-block__picker">{picker}</div>
        </Placeholder>
      </div>
    )
  }
  return (
    <>
      <InspectorControls>
        <PanelBody title={t('post.formPanel')}>{picker}</PanelBody>
      </InspectorControls>
      <div {...blockProps}>
        <div className="cp-form-block__card">
          <strong>{a.title || t('forms.unknownForm')}</strong>
          <small>{t('forms.cardNote', { domain: a.domain || domain })}</small>
          {domain && a.domain && a.domain !== domain && (
            <small className="cp-form-block__warn">
              {t('forms.wrongDomain', { domain: a.domain, site: domain })}
            </small>
          )}
        </div>
      </div>
    </>
  )
}

function FormSave({ attributes: a }: { attributes: FormAttributes }): React.JSX.Element | null {
  if (!a.key || !a.loaderUrl) return null
  return <RawHTML>{embedSnippet(a.key, a.loaderUrl)}</RawHTML>
}

export function registerFormBlock(): void {
  registerBlockType(FORM_BLOCK, {
    apiVersion: 3,
    title: translate('post.formTitle'),
    description: translate('post.formDescription'),
    category: 'embed',
    icon: envelope,
    keywords: ['form', 'contact', 'booking', 'craftforms'],
    attributes: {
      key: {
        type: 'string',
        source: 'attribute',
        selector: 'div[data-craftforms-embed]',
        attribute: 'data-craftforms-embed',
        default: ''
      },
      loaderUrl: {
        type: 'string',
        source: 'attribute',
        selector: 'script',
        attribute: 'src',
        default: ''
      },
      formId: { type: 'string', default: '' },
      title: { type: 'string', default: '' },
      domain: { type: 'string', default: '' }
    },
    supports: { html: false, reusable: false, align: ['wide', 'full'] },
    edit: FormEdit,
    save: FormSave
  } as never)
}
