import { useEffect, useRef, useState } from 'react';
import { idbGet, idbSet } from '../core/db';

/** 与 IndexedDB 双向绑定的 state：初次从库读取，变化即落库。 */
export function usePersistent<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    let alive = true;
    idbGet<T>(key)
      .then((v) => {
        if (!alive) return;
        if (v !== undefined) setValue(v);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    if (first.current) {
      first.current = false;
      return;
    }
    idbSet(key, value).catch(() => undefined);
  }, [key, value, loaded]);

  return [value, setValue, loaded] as const;
}
