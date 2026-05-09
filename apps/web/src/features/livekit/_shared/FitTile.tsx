import { useElementSize } from '../../../hooks/useElementSize.ts';

const ASPECT_RATIO = 16 / 9;

/**
 * 부모 cell 크기를 측정해 16:9 비율로 fit한 wrapper.
 *
 * CSS `aspect-ratio` + max constraints 조합이 flex item에서 의도대로
 * 동작하지 않아 JS 측정으로 정확한 사이즈를 inline style에 적용.
 */
export function FitTile({ children }: { children: React.ReactNode }) {
  const [ref, { width: w, height: h }] = useElementSize<HTMLDivElement>();
  let cardW = 0;
  let cardH = 0;
  if (w > 0 && h > 0) {
    if (w / h > ASPECT_RATIO) {
      cardH = h;
      cardW = h * ASPECT_RATIO;
    } else {
      cardW = w;
      cardH = w / ASPECT_RATIO;
    }
  }
  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      <div
        style={
          cardW > 0
            ? { width: cardW, height: cardH }
            : { width: '100%', aspectRatio: '16 / 9' }
        }
      >
        {children}
      </div>
    </div>
  );
}
