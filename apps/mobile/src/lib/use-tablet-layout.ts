import { useWindowDimensions } from 'react-native';

/** Tablet breakpoints aligned with Airbnb-style wide layouts (600px+). */
export function useTabletLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isLandscape = width > height;
  const contentMaxWidth = isTablet ? Math.min(768, width * 0.88) : width;
  const horizontalPadding = isTablet ? 32 : 20;
  const twoColumn = isTablet && isLandscape;

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
