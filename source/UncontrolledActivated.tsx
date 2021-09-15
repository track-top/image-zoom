import React, {
  FC,
  ReactNode,
  RefObject,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { isEscapeKey } from '@rpearce/ts-dom-fns'
import useEvent from 'react-use/lib/useEvent'
import useWindowSize from 'react-use/lib/useWindowSize'
import ICompress from './ICompress'
import {
  getModalContentStyle,
  getModalOverlayStyle,
  pseudoParentEl,
} from './helpers'

const rmizPortalEl = document.createElement(`div`)
document.body.appendChild(rmizPortalEl)

export interface Styles {
  height?: number
  left?: number
  top?: number
  width?: number
}

export interface UncontrolledActivatedProps {
  children: ReactNode
  closeText?: string
  modalLabelText?: string
  onUnload: () => void
  onLoad: () => void
  overlayBgColorEnd?: string
  overlayBgColorStart?: string
  parentRef: RefObject<HTMLElement>
  portalEl?: HTMLElement
  scrollableEl?: HTMLElement | Window
  transitionDuration?: number
  zoomMargin?: number
  zoomZindex?: number
  styles: Styles
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

const UncontrolledActivated: FC<UncontrolledActivatedProps> = ({
  children,
  closeText = `Unzoom Image`,
  modalLabelText,
  onUnload,
  onLoad,
  overlayBgColorEnd = `rgba(255, 255, 255, 0.95)`,
  overlayBgColorStart = `rgba(255, 255, 255, 0)`,
  parentRef,
  portalEl = rmizPortalEl,
  scrollableEl = window,
  transitionDuration = 300,
  zoomMargin = 0,
  zoomZindex = 2147483647,
  styles,
}: UncontrolledActivatedProps) => {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [, forceUpdate] = useState<number>(0)
  const [isLoaded, setIsLoaded] = useState<boolean>(false)
  const [isUnloading, setIsUnloading] = useState<boolean>(false)
  const { width: innerWidth, height: innerHeight } = useWindowSize()

  // on click, begin unloading
  const handleClick = useCallback(() => {
    setIsUnloading(true)
  }, [])

  // on escape, begin unloading
  const handleKeyDown = useCallback(e => {
    if (isEscapeKey(e)) {
      e.stopPropagation()
      setIsUnloading(true)
    }
  }, [])

  // on scroll, begin unloading
  const handleScroll = useCallback(() => {
    forceUpdate(n => n + 1)

    if (!isUnloading) {
      setIsUnloading(true)
    }
  }, [isUnloading])

  // listen for keydown on the document
  useEvent(`keydown`, handleKeyDown, document)

  // listen for scroll and close
  useEvent(`scroll`, handleScroll, scrollableEl)

  // set loaded on mount and focus
  useEffect(() => {
    setIsLoaded(true)
    onLoad()

    // TODO
    if (btnRef.current) {
      const { scrollEl, scrollLeft, scrollTop } = getScroll(scrollableEl)

      btnRef.current.focus({ preventScroll: true })

      if (scrollableEl) {
        if (scrollEl instanceof Window) {
          window.scrollTo(scrollLeft, scrollTop)
        } else {
          scrollEl.scrollLeft = scrollLeft
          scrollEl.scrollTop  = scrollTop
        }
      }
    }
  }, [onLoad, scrollableEl])

  // if unloading, tell parent that we're all done here after Nms
  useEffect(() => {
    const unloadTimeout = isUnloading
      ? setTimeout(onUnload, transitionDuration)
      : null

    return (): void => {
      if (unloadTimeout) {
        clearTimeout(unloadTimeout)
      }
    }
  }, [isUnloading, onUnload, transitionDuration])

  // use parent element or fake one if it's not yet loaded
  const parentEl = parentRef.current || pseudoParentEl

  // get parent item's dimensions
  const { height, left, top, width } = parentEl.getBoundingClientRect()

  const overlayStyle = getModalOverlayStyle({
    isLoaded,
    isUnloading,
    overlayBgColorEnd,
    overlayBgColorStart,
    transitionDuration,
    zoomZindex,
  })

  const contentStyle = getModalContentStyle({
    height,
    isLoaded,
    innerHeight,
    innerWidth,
    isUnloading,
    left,
    originalTransform: parentEl.style.transform,
    top,
    transitionDuration,
    width,
    zoomMargin,
  })

  return createPortal(
    <div data-rmiz-overlayBgColorStart>
      <div
        tabIndex={0} /* eslint-disable-line jsx-a11y/no-noninteractive-tabindex */
      />
      <div
        aria-label={modalLabelText}
        aria-modal="true"
        role="dialog"
        style={overlayStyle}
        tabIndex={-1}
      >
        <div data-rmiz-modal-content style={contentStyle}>
          {children}
        </div>
        <button
          aria-label={closeText}
          data-rmiz-btn-close
          onClick={handleClick}
          ref={btnRef}
          type="button"
        >
          <ICompress />
        </button>
      </div>
      <div
        tabIndex={0} /* eslint-disable-line jsx-a11y/no-noninteractive-tabindex */
      />
    </div>,
    portalEl
  )
}

export default memo(UncontrolledActivated)
