import React, {
  CSSProperties,
  FC,
  ReactNode,
  StrictMode,
  memo,
  useCallback,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import UncontrolledActivated from './UncontrolledActivated'
import IEnlarge from './IEnlarge'
import useImgGhost from './useImgGhost'

const rmizPortalEl = document.createElement(`div`)
document.body.appendChild(rmizPortalEl)

export interface UncontrolledProps {
  children: ReactNode
  closeText?: string
  modalLabelText?: string
  openText?: string
  overlayBgColorEnd?: string
  overlayBgColorStart?: string
  portalEl?: HTMLElement
  scrollableEl?: HTMLElement | Window
  transitionDuration?: number
  wrapStyle?: CSSProperties
  zoomMargin?: number
  zoomZindex?: number
}

export interface GetScroll {
  (scrollableEl?: HTMLElement | Window): ({
    scrollEl:    HTMLElement | Window,
    scrollLeft:  number,
    scrollTop:   number,
  })
}

const getScroll: GetScroll = scrollableEl => {
  const scrollEl = (scrollableEl ||
    document.scrollingElement ||
    document.documentElement) as HTMLElement | Window

  const scrollLeft = scrollEl instanceof Window
    ? window.scrollX
    : scrollEl.scrollLeft

  const scrollTop  = scrollEl instanceof Window
    ? window.scrollY
    : scrollEl.scrollTop

  return { scrollEl, scrollLeft, scrollTop }
}

const Uncontrolled: FC<UncontrolledProps> = ({
  children,
  closeText = `Unzoom image`,
  modalLabelText = `Zoomed image`,
  overlayBgColorEnd = `rgba(255, 255, 255, 0.95)`,
  overlayBgColorStart = `rgba(255, 255, 255, 0)`,
  portalEl,
  openText = `Zoom image`,
  scrollableEl,
  transitionDuration = 300,
  wrapStyle,
  zoomMargin = 0,
  zoomZindex = 2147483647,
}: UncontrolledProps) => {
  const [isActive, setIsActive]           = useState(false)
  const [isChildLoaded, setIsChildLoaded] = useState(false)

  const refWrap    = useRef<HTMLDivElement>(null)
  const refContent = useRef<HTMLDivElement>(null)
  const refBtn     = useRef<HTMLButtonElement>(null)

  const isExpanded = isActive && isChildLoaded
  const wrapType   = isExpanded ? `hidden` : `visible`
  const styleGhost = useImgGhost(refContent)

  const handleClickTrigger = useCallback(() => {
    if (!isActive) {
      setIsActive(true)
    }
  }, [isActive])

  //const handleChildLoad = useCallback(() => {
  //  setIsChildLoaded(true)
  //}, [])

  //const handleChildUnload = useCallback(() => {
  //  setIsActive(false)
  //  setIsChildLoaded(false)

  //  if (refBtn.current) {
  //    const { scrollEl, scrollLeft, scrollTop } = getScroll(scrollableEl)

  //    refBtn.current.focus({ preventScroll: true })

  //    if (scrollableEl) {
  //      if (scrollEl instanceof Window) {
  //        window.scrollTo(scrollLeft, scrollTop)
  //      } else {
  //        scrollEl.scrollLeft = scrollLeft
  //        scrollEl.scrollTop  = scrollTop
  //      }
  //    }
  //  }
  //}, [scrollableEl])

  return (
    <StrictMode>
      <div data-rmiz={wrapType} ref={refWrap} style={wrapStyle}>
        <div data-rmiz-ghost style={styleGhost}>
          <button
            aria-label={openText}
            data-rmiz-btn-open
            onClick={handleClickTrigger}
            ref={refBtn}
            type="button"
          >
            <IEnlarge />
          </button>
        </div>
        <div data-rmiz-content ref={refContent}>
          {children}
        </div>
        {/*createPortal(
          <UA

          />,
          rmizPortalEl
          )*/}
        {/*<UncontrolledActivated
          closeText={closeText}
          modalLabelText={modalLabelText}
          onLoad={handleChildLoad}
          onUnload={handleChildUnload}
          overlayBgColorEnd={overlayBgColorEnd}
          overlayBgColorStart={overlayBgColorStart}
          parentRef={refWrap}
          portalEl={portalEl}
          scrollableEl={scrollableEl}
          transitionDuration={transitionDuration}
          zoomMargin={zoomMargin}
          zoomZindex={zoomZindex}
        >
          {children}
        </UncontrolledActivated>*/}
      </div>
    </StrictMode>
  )
}

export default memo(Uncontrolled)
