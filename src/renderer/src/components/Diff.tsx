import { useMemo } from 'react'
import { useT } from '../i18n'
import { diffLines, hunks } from '../../../shared/diff'
import type { ProposalFile } from '../../../shared/types'

export default function Diff({ file }: { file: ProposalFile }): React.JSX.Element {
  const t = useT()
  const groups = useMemo(() => hunks(diffLines(file.before ?? '', file.after ?? '')), [file])
  const added = groups.reduce((n, g) => n + g.lines.filter((l) => l.type === 'add').length, 0)
  const removed = groups.reduce((n, g) => n + g.lines.filter((l) => l.type === 'del').length, 0)

  return (
    <div className="diff">
      <div className="diff__head">
        <span className="mono diff__path">{file.path}</span>
        <span className="diff__stats">
          {file.before === null && <span className="badge">{t('ai.newFile')}</span>}
          {file.after === null && (
            <span className="badge badge--danger">{t('ai.deletedFile')}</span>
          )}
          <span className="diff__add" aria-hidden="true">
            +{added}
          </span>
          <span className="diff__del" aria-hidden="true">
            −{removed}
          </span>
          <span className="visually-hidden">
            {t('ai.linesAdded', { count: added })}, {t('ai.linesRemoved', { count: removed })}
          </span>
        </span>
      </div>
      <div
        className="diff__body"
        role="region"
        tabIndex={0}
        aria-label={t('ai.changesIn', { path: file.path })}
      >
        {groups.map((group, index) => (
          <table key={index} className="diff__hunk">
            <tbody>
              {group.lines.map((line, k) => (
                <tr key={k} className={`diff__line diff__line--${line.type}`}>
                  <td className="diff__num">{line.a ?? ''}</td>
                  <td className="diff__num">{line.b ?? ''}</td>
                  <td className="diff__sign">
                    {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '}
                  </td>
                  <td className="diff__text">{line.text || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}
