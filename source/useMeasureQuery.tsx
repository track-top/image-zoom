import { useLayoutEffect, useMemo, useState } from 'react'

export type UseMeasureQueryRect = Pick<
  DOMRectReadOnly,
  'bottom' | 'height' | 'left' | 'right' | 'top' | 'width' | 'x' | 'y'
>

const initialStyles: UseMeasureQueryRect = {
  bottom:  0,
  height:  0,
  left:    0,
  right:   0,
  top:     0,
  width:   0,
  x:       0,
  y:       0,
}

export interface UseMeasureQuery {
  (query: () => HTMLElement | null | undefined): UseMeasureQueryRect
}

const useMeasureQuery: UseMeasureQuery = (query) => {
  const [rect, setRect] = useState<UseMeasureQueryRect>(initialStyles)

  const resizeObserver = useMemo(() => {
    return new ResizeObserver(entries => {
      const entry = entries[0]

      if (entry) {
        const { bottom, height, left, right, top, width, x, y } =
          entry.contentRect

        setRect({ bottom, height, left, right, top, width, x, y })
      }
    })
  }, [])

  useLayoutEffect(() => {
    const el = query()

    if (!el) {
      return
    }

    resizeObserver.observe(el)

    return () => {
      resizeObserver.disconnect()
    }
  }, [query, resizeObserver])

  return rect
}

export default useMeasureQuery
