import { RefObject, useLayoutEffect, useMemo, useState } from 'react'

export type UseMeasureChildImgRect = Pick<
  DOMRectReadOnly,
  'height' | 'left' | 'top' | 'width'
>

const initialStyles: UseMeasureChildImgRect = {
  height:  0,
  left:    0,
  top:     0,
  width:   0,
}

export interface UseMeasureChildImg {
  (target: RefObject<HTMLElement>): UseMeasureChildImgRect
}

const useMeasureChildImg: UseMeasureChildImg = (targetRef) => {
  const [rect, setRect] = useState<UseMeasureChildImgRect>(initialStyles)

  const resizeObserver = useMemo(() => {
    return new ResizeObserver(entries => {
      const entry = entries[0]

      if (entry) {
        const { height, left, top, width } = entry.contentRect
        setRect({ height, left, top, width })
      }
    })
  }, [])

  useLayoutEffect(() => {
    const img = targetRef.current?.querySelector('img') as HTMLImageElement

    if (!img) {
      return
    }

    resizeObserver.observe(img)

    return () => {
      resizeObserver.disconnect()
    }
  }, [resizeObserver, targetRef])

  return rect
}

export default useMeasureChildImg
