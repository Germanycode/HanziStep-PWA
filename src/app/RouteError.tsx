import { isRouteErrorResponse, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold text-danger">Đã có lỗi xảy ra</h1>
      <pre className="mt-4 rounded-xl bg-surface p-4 text-sm whitespace-pre-wrap text-sub">{message}</pre>
      <a href="/" className="mt-4 inline-block text-primary hover:underline">
        Tải lại trang Hôm nay
      </a>
    </main>
  );
}
