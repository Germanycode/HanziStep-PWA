import { Link } from 'react-router';
import { vi } from '@/i18n/vi';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="font-hanzi text-6xl text-seal">迷路</p>
      <h1 className="mt-4 text-2xl font-bold text-fg">{vi.notFound.title}</h1>
      <Link to="/" className="mt-6 inline-block text-primary hover:underline">
        {vi.notFound.back}
      </Link>
    </div>
  );
}
