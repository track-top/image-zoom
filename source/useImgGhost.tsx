import {
  RefObject,
  useCallback,
  useLayoutEffect,
  useState,
} from 'react'
import { useEvent } from 'react-use'

export interface UseImgGhostStyles {
  height?:        number
  left?:          number
  pointerEvents:  'none'
  position:       'absolute'
  top?:           number
  width?:         number
}

export interface UseImgGhost {
  (target: RefObject<HTMLElement>): UseImgGhostStyles
}

const useImgGhost: UseImgGhost = (targetRef) => {
  const [styleGhost, setStyleGhost] = useState({
    pointerEvents:  'none',
    position:       'absolute',
  } as UseImgGhostStyles)

  const setGhost = useCallback(img => {
    const box = img?.getBoundingClientRect()
    const topBox = targetRef.current?.getBoundingClientRect()

    if (topBox && box) {
      setStyleGhost({
        height:         box.height,
        left:           topBox.left - box.left,
        pointerEvents:  'none',
        position:       'absolute',
        top:            topBox.top - box.top,
        width:          box.width,
      })
    }
  }, [targetRef])

  const setGhostOnLoad = useCallback(e => {
    const img = e.target as HTMLImageElement
    img.removeEventListener('load', setGhost)
    setGhost(img)
  }, [setGhost])

  const setupGhost = useCallback(() => {
    const img = targetRef.current?.querySelector('img') as HTMLImageElement

    if (!img) {
      return
    }

    if (img.complete && img.naturalWidth !== 0) {
      setGhost(img)
    } else {
      img.addEventListener('load', setGhostOnLoad)
    }
  }, [setGhost, setGhostOnLoad, targetRef])

  useLayoutEffect(setupGhost, [setupGhost])
  useEvent('resize', setupGhost, window)

  return styleGhost
}

export default useImgGhost
