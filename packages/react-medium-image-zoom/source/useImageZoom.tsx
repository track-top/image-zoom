import { Ref, useCallback, useEffect, useRef } from 'react'
import ImageZoom, {
  ImageZoomReturnType,
  ImageZoomUpdateOpts,
} from '@rpearce/image-zoom'

export interface UseImageZoom {
  (opts?: ImageZoomUpdateOpts): { ref: Ref<HTMLElement> }
}

const useImageZoom: UseImageZoom = (opts) => {
  const ref = useRef<HTMLElement>(null)
  const savedOpts = useRef<ImageZoomUpdateOpts | undefined>(opts)
  const imgZoom = useRef<ImageZoomReturnType>()

  const setup = useCallback(() => {
    const el = ref.current

    if (!el) return

    imgZoom.current = ImageZoom(savedOpts.current, el)

    if (savedOpts.current?.isZoomed) {
      imgZoom.current?.update(savedOpts.current)
    }
  }, [])

  const cleanup = useCallback(() => {
    imgZoom.current?.cleanup()
    imgZoom.current = undefined
  }, [])

  useEffect(() => {
    savedOpts.current = opts
    imgZoom.current?.update(savedOpts.current)
  }, [opts])

  useEffect(() => {
    setup()

    return (): void => {
      cleanup()
    }
  }, [cleanup, setup])

  useEffect(() => {
    if (ref.current) {
      if (!imgZoom.current) {
        setup()
      }
    } else {
      cleanup()
    }
  })

  return { ref }
}

export default useImageZoom

//import React, { memo, useCallback, useEffect, useRef } from 'react'
//import cx from 'classnames'
//import { getBlockImgAlt } from '../utils/image'
//import { init as initZoom } from '../utils/zoom'
//import SWNEArrows from './icons/SWNEArrows'
//import './Image.scss'

//const Image = ({
//  alt,
//  allowTabNavigation = true,
//  caption,
//  disableZoom,
//  fileName,
//  imageKey,
//  onLoad,
//  src,
//}) => {
//  const imgRef = useRef()
//  const izRef = useRef()
//  const altValue = getBlockImgAlt({ alt, caption, fileName, key: imageKey })
//  const shouldZoom = allowTabNavigation && !disableZoom

//  const handleClick = useCallback(e => {
//    izRef.current.zoom(imgRef.current, e.currentTarget, {})
//  }, [])

//  useEffect(() => {
//    const iz = initZoom()
//    izRef.current = iz

//    return () => {
//      iz.cleanup()
//    }
//  }, [])

//  const imgCn = cx('img-img', { 'img-zoom': shouldZoom })
//  const imgOnClick = shouldZoom ? handleClick : undefined

//  return (
//    <div className="img">
//      <img // eslint-disable-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
//        alt={altValue}
//        className={imgCn}
//        onClick={imgOnClick}
//        onLoad={onLoad}
//        ref={imgRef}
//        src={src}
//      />
//      {shouldZoom &&
//        <button
//          aria-label="Zoom image"
//          className="img-btn img-zoom visually-hidden"
//          onClick={handleClick}
//        >
//          <SWNEArrows aria-hidden="true" className="img-btn-symbol" />
//        </button>
//      }
//    </div>
//  )
//}

//export default memo(Image)
