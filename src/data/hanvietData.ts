import type { HanvietData } from '@/chinese/hanviet';
import { cachedLoader, fetchDataJson } from './fetchData';
import { DATA_BASE_URL } from './manifest';

const load = cachedLoader((_: 'hanviet') => fetchDataJson<HanvietData>(`${DATA_BASE_URL}/hanviet.json`));

export function loadHanvietData(): Promise<HanvietData> {
  return load('hanviet');
}
