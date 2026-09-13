import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { vi } from '@/i18n/vi';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { DATA_SOURCES } from './sources';

export function SourcesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={vi.nav.sources}
        subtitle="HanziStep được xây trên dữ liệu mở. Xin cảm ơn các tác giả dưới đây."
        actions={
          <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> {vi.nav.settings}
          </Link>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted uppercase">
              <tr>
                <th className="py-2 pr-4">Nguồn</th>
                <th className="py-2 pr-4">Dùng cho</th>
                <th className="py-2 pr-4">Giấy phép</th>
                <th className="py-2">Ghi công</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {DATA_SOURCES.map((source) => (
                <tr key={source.name} className="align-top">
                  <td className="py-3 pr-4">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      {source.name}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </td>
                  <td className="py-3 pr-4 text-sub">{source.usage}</td>
                  <td className="py-3 pr-4 text-fg">{source.license}</td>
                  <td className="py-3 text-sub">{source.attribution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Lưu ý về giấy phép">
        <p className="text-sm text-sub">
          Dữ liệu CC BY-SA (CC-CEDICT, CVDICT, audio-cmn) cho phép dùng tự do nhưng phải ghi công, và dữ liệu phái sinh
          phải giữ cùng giấy phép khi chia sẻ. Bản sao đầy đủ của từng giấy phép nằm trong{' '}
          <code className="rounded bg-surface-2 px-1">public/data/v1/LICENSES</code> sau khi build dữ liệu.
        </p>
      </Card>
    </div>
  );
}
