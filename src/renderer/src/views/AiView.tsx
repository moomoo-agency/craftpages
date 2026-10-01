import { useEffect, useId, useState } from 'react'
import Diff from '../components/Diff'
import { Notice, Section } from '../components/Field'
import { useT, type Key } from '../i18n'
import { copyText, errorMessage, formatDate, useAppEvent } from '../lib/api'
import type { McpStatus, Proposal } from '../../../shared/types'

interface Props {
  mcp: McpStatus | null
  onOpenSettings: () => void
}

const STATUS_LABEL: Record<Proposal['status'], Key> = {
  pending: 'ai.statusPending',
  accepted: 'ai.statusAccepted',
  rejected: 'ai.statusRejected',
  reverted: 'ai.statusReverted',
  failed: 'ai.statusFailed'
}

function ProposalCard({ proposal }: { proposal: Proposal }): React.JSX.Element {
  const t = useT()
  const bodyId = useId()
  const [open, setOpen] = useState(proposal.status === 'pending')
  const [preview, setPreview] = useState<string | null>(null)
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pages = proposal.files.filter((file) => file.path.endsWith('.html') && file.after !== null)

  const act = async (task: () => Promise<void>): Promise<void> => {
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const showPreview = (path: string): Promise<void> =>
    act(async () => {
      setPreview(await window.api.proposalPreviewUrl(proposal.id, path))
      setPreviewPath(path)
    })

  return (
    <article className={`proposal proposal--${proposal.status}`}>
      <h3 className="proposal__heading">
        <button
          type="button"
          className="proposal__head"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="proposal__chevron" aria-hidden="true">
            ›
          </span>
          <span className="proposal__summary">
            <span className="proposal__title">{proposal.title}</span>
            <span className="proposal__meta">
              {[
                proposal.client,
                formatDate(proposal.createdAt),
                t('ai.files', { count: proposal.files.length })
              ].join(' · ')}
            </span>
          </span>
          <span className={`pill pill--${proposal.status}`}>
            {t(STATUS_LABEL[proposal.status])}
          </span>
        </button>
      </h3>

      {open && (
        <div className="proposal__body" id={bodyId}>
          {proposal.description && <p className="proposal__desc">{proposal.description}</p>}
          {proposal.reason && (
            <Notice kind={proposal.status === 'failed' ? 'error' : 'info'}>
              {proposal.reason}
            </Notice>
          )}

          {proposal.status === 'pending' && (
            <div className="proposal__actions">
              <button
                className="btn btn--primary"
                onClick={() => act(() => window.api.acceptProposal(proposal.id))}
              >
                {t('ai.accept')}
              </button>
              <input
                value={reason}
                aria-label={t('ai.reason')}
                placeholder={t('ai.reasonPlaceholder')}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                className="btn btn--danger-outline"
                onClick={() => act(() => window.api.rejectProposal(proposal.id, reason))}
              >
                {t('ai.reject')}
              </button>
            </div>
          )}
          {proposal.status === 'accepted' && (
            <div className="proposal__actions">
              <button
                className="btn"
                onClick={() => act(() => window.api.revertProposal(proposal.id))}
              >
                {t('common.revert')}
              </button>
            </div>
          )}
          {error && (
            <div role="alert">
              <Notice kind="error">{error}</Notice>
            </div>
          )}

          {proposal.status === 'pending' && pages.length > 0 && (
            <div className="proposal__preview">
              <div className="proposal__preview-bar">
                <span className="muted small">{t('ai.previewAfter')}</span>
                {pages.map((file) => (
                  <button
                    key={file.path}
                    className="btn btn--small mono"
                    aria-pressed={preview !== null && previewPath === file.path}
                    onClick={() => showPreview(file.path)}
                  >
                    {file.path}
                  </button>
                ))}
                {preview && (
                  <button className="btn btn--small btn--ghost" onClick={() => setPreview(null)}>
                    {t('ai.hidePreview')}
                  </button>
                )}
              </div>
              {preview && (
                <iframe
                  src={preview}
                  title={t('ai.previewTitle', { path: previewPath ?? '' })}
                  sandbox="allow-scripts"
                />
              )}
            </div>
          )}

          {proposal.files.map((file) => (
            <Diff key={file.path} file={file} />
          ))}
        </div>
      )}
    </article>
  )
}

export default function AiView({ mcp, onOpenSettings }: Props): React.JSX.Element {
  const t = useT()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.api.listProposals().then(setProposals)
  }, [])

  useAppEvent((event) => {
    if (event.type === 'proposals') setProposals(event.proposals)
  })

  const pending = proposals.filter((p) => p.status === 'pending').length

  return (
    <div className="ai-view">
      <Section
        title={t('ai.connectTitle')}
        description={t('ai.connectDescription')}
        actions={
          <button className="btn btn--ghost" onClick={onOpenSettings}>
            {t('ai.openSettings')}
          </button>
        }
      >
        {mcp ? (
          <>
            <p className="status-line" role="status">
              <span className={`dot ${mcp.running ? 'dot--on' : ''}`} aria-hidden="true" />
              {mcp.running
                ? mcp.clients.length
                  ? t('ai.connected', { clients: mcp.clients.join(', ') })
                  : t('ai.waiting', { url: mcp.url })
                : (mcp.error ?? t('ai.off'))}
            </p>
            <ol className="steps ai-view__steps">
              <li>{t('ai.stepOpen')}</li>
              <li>
                {t('ai.stepCommand')}
                <div className="input-group">
                  <input
                    className="mono"
                    readOnly
                    value={mcp.command}
                    aria-label={t('ai.command')}
                  />
                  <button
                    className="btn btn--accent"
                    aria-label={copied ? undefined : t('ai.copyCommand')}
                    onClick={async () => {
                      await copyText(mcp.command)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1500)
                    }}
                  >
                    {copied ? t('common.copied') : t('common.copy')}
                  </button>
                  <span className="visually-hidden" role="status">
                    {copied ? t('common.copied') : ''}
                  </span>
                </div>
                <span className="muted small">{t('ai.stepCommandHint')}</span>
              </li>
              <li>
                {t('ai.stepStart')}
                <span className="muted small">{t('ai.stepStartHint')}</span>
              </li>
              <li>{t('ai.stepAsk')}</li>
            </ol>
            <label className="check">
              <input
                type="checkbox"
                checked={mcp.autoAccept}
                onChange={(e) => window.api.setAutoAccept(e.target.checked)}
              />
              <span>
                {t('ai.autoAccept')}
                <span className="check__hint">{t('ai.autoAcceptHint')}</span>
              </span>
            </label>
          </>
        ) : (
          <p className="muted">{t('common.loading')}</p>
        )}
      </Section>

      <section className="proposals" aria-labelledby="proposals-title">
        <h2 id="proposals-title">
          {t('ai.proposals')}
          {pending > 0 && <span className="badge">{t('ai.waitingCount', { count: pending })}</span>}
        </h2>
        {proposals.length === 0 ? (
          <p className="muted proposals__empty">{t('ai.empty')}</p>
        ) : (
          proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />)
        )}
      </section>
    </div>
  )
}
