import { useWindowDimensions } from 'react-native';

/** Tablet breakpoints aligned with web md (768px+) layouts. */
export function useTabletLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;
  const contentMaxWidth = isTablet ? Math.min(960, width * 0.88) : width;
  const horizontalPadding = isTablet ? 32 : 20;
  const twoColumn = isTablet;

  return {
    isTablet,
    isLandscape,
    contentMaxWidth,
    horizontalPadding,
    twoColumn,
    /** Guard scanner: larger preview on tablet portrait/landscape */
    scannerFlex: isTablet ? (isLandscape ? 1.2 : 1) : 1,
    detailFlex: isTablet ? 0.8 : 0,
  };
}
