import { palette } from '@smartresidence/ui-mobile';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';

type SmartRefreshControlProps = Omit<
  RefreshControlProps,
  'colors' | 'progressBackgroundColor' | 'tintColor' | 'title' | 'titleColor'
> & {
  indicatorColor?: string;
  indicatorBackgroundColor?: string;
};

export function SmartRefreshControl({
  indicatorColor = palette.coralPrimary,
  indicatorBackgroundColor = 'rgba(255,255,255,0.92)',
  ...props
}: SmartRefreshControlProps) {
  return (
    <RefreshControl
      {...props}
      colors={[indicatorColor]}
      progressBackgroundColor={indicatorBackgroundColor}
      tintColor={indicatorColor}
      title=""
      titleColor="transparent"
    />
  );
}

export function usePullToRefresh(onRefresh: () => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = useState(false);

  // Callers usually pass a useCallback whose deps include whole query objects, so its
  // identity changes every render. Keep the latest in a ref so handleRefresh (and the
  // memoized control element below) stay reference-stable and don't rebuild each render.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.resolve(onRefreshRef.current())
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, []);

  const refreshControl = useMemo(
    () => <SmartRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />,
    [refreshing, handleRefresh],
  );

  return {
    refreshing,
    onRefresh: handleRefresh,
    refreshControl,
  };
}
