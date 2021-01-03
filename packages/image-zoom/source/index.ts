//import 'focus-options-polyfill' @TODO: ADD NOTE IN README TO INCLUDE IF YOU
//                                       NEED TO SUPPORT.
import {
  addEventListener,
  appendChild,
  blur,
  cloneElement,
  createElement,
  focus,
  forEachSibling,
  getAttribute,
  getBoundingClientRect,
  getComputedStyle,
  getNextSibling,
  getParentNode,
  getPreviousSibling,
  getScaleToWindow,
  getScaleToWindowMax,
  getStyleProperty,
  getWindowInnerHeight,
  getWindowInnerWidth,
  getWindowPageXOffset,
  getWindowPageYOffset,
  insertAdjacentElement,
  isEscapeKey,
  raf,
  removeAttribute,
  removeChild,
  removeEventListener,
  setAttribute,
  setInnerHTML,
  setInnerText,
  setStyleProperty,
  setTimeout,
  stopPropagation,
} from '@rpearce/ts-dom-fns'


export interface ImageZoom {
  (opts?: Opts): ({
    attach: Attach,
    detach: Detach,
    teardown: Teardown,
    unzoom: Unzoom,
    update: Update,
    zoom: Zoom,
  })
}

export interface Opts {
  auto?: boolean
  margin?: number
  onChange?: ({ type, value }: {
    type: string,
    value: string | boolean
  }) => void
  overlayBgColor?: string
  overlayOpacity?: number
  transitionDuration?: number
  unzoomLabel?: string
  zIndex?: number
  zoomLabel?: string
  zoomTitle?: string
}

export interface Attach {
  (...els: (
    HTMLImageElement
    | HTMLImageElement[]
    | NodeListOf<HTMLImageElement>
    | SVGElement
    | SVGElement[]
    | NodeListOf<SVGElement>
  )[]): void
}

export interface Detach {
  (el: HTMLImageElement | SVGElement, skipTracking?: boolean): void
}

export interface Reset {
  (): void
}

export interface Teardown {
  (): void
}

export interface Update {
  (opts: Opts): void
}

export interface Unzoom {
  (): void
}

export interface Zoom {
  (el: HTMLImageElement | SVGElement | EventTarget | null): void
}

enum States {
  UNZOOMED = 'UNZOOMED',
  UNZOOMING = 'UNZOOMING',
  ZOOMED = 'ZOOMED',
  ZOOMING = 'ZOOMING',
}

enum Actions {
  UNZOOM = 'UNZOOM',
  ZOOM = 'ZOOM'
}

type Action =
  | { type: 'ACTION', value: Actions }
  | { type: 'STATE', value: States }

const { UNZOOMED, UNZOOMING, ZOOMED, ZOOMING } = States
const { UNZOOM, ZOOM } = Actions

const imageZoom: ImageZoom = ({
  auto = true,
  margin = 0,
  onChange = undefined,
  overlayBgColor = '#fff',
  overlayOpacity = 1,
  transitionDuration = 300,
  unzoomLabel = 'Unzoom image',
  zIndex = 2147483647,
  zoomLabel = 'Zoom image',
  zoomTitle = 'Zoomed item',
} = {}) => {
  const documentBody = document.body
  const win = window
  let modalBoundaryStartEl: HTMLDivElement | undefined
  let modalBoundaryStopEl: HTMLDivElement | undefined
  let modalContainerEl: HTMLDivElement | undefined
  let modalDialogEl: HTMLDivElement | undefined
  let modalDialogUnzoomBtnEl: HTMLButtonElement | undefined
  let modalDialogImgEl: HTMLImageElement | undefined
  let modalDialogLabelEl: HTMLDivElement | undefined
  let modalOverlayEl: HTMLDivElement | undefined
  let state: States = UNZOOMED
  let trackedEls: (HTMLImageElement | SVGElement)[] = []

  const attach: Attach = (...args) => {
    if (!args.length) return

    interface Setup {
      (el: HTMLImageElement | SVGElement): void
    }

    const setup: Setup = (el) => {
      if (el instanceof HTMLImageElement || el instanceof SVGElement) {
        setStyleProp(CURSOR, 'pointer', el)
        setStyleProp(CURSOR, 'zoom-in', el)

        // init zoom button
        const zoomBtnEl = createElement(BUTTON) as HTMLButtonElement
        setAttribute(ARIA_LABEL, zoomLabel, zoomBtnEl)
        setAttribute(DATA_RMIZ_ZOOM_BTN, '', zoomBtnEl)
        setAttribute(STYLE, styleZoomBtnHidden, zoomBtnEl)
        setAttribute(TYPE, BUTTON, zoomBtnEl)
        setInnerHTML(zoomBtnEl, ZOOM_BTN_SVG)

        // insert zoom button after img
        insertAdjacentElement(el, 'afterend', zoomBtnEl)

        if (auto) {
          addEventListener(CLICK, handleImgClick, el)
          addEventListener(CLICK, handleZoomBtnClick, zoomBtnEl)
          addEventListener(FOCUS, handleZoomBtnFocus, zoomBtnEl)
          addEventListener(BLUR, handleZoomBtnBlur, zoomBtnEl)
          trackedEls.push(el)
        }
      }
    }

    for (const arg of args) {
      if (arg instanceof NodeList || arg instanceof Array) {
        for (const item of arg as Array<HTMLImageElement | SVGElement>) {
          setup(item)
        }
      } else {
        setup(arg)
      }
    }
  }

  const detach: Detach = (el, skipTracking = false) => {
    if (!skipTracking) {
      trackedEls = trackedEls.filter(x => x !== el)
    }

    if (el) {
      setStyleProp(CURSOR, '', el)
    }

    if (auto) {
      if (el) {
        removeEventListener(CLICK, handleImgClick, el)

        const zoomBtnEl = getNextSibling(el)

        if (zoomBtnEl instanceof HTMLButtonElement) {
          removeEventListener(FOCUS, handleZoomBtnFocus, zoomBtnEl)
          removeEventListener(BLUR, handleZoomBtnBlur, zoomBtnEl)
        }
      }
    }
  }

  interface Dispatch {
    (action: Action): void
  }

  const dispatch: Dispatch = ({ type, value }) => {
    if (onChange) {
      onChange({ type, value })
    }
  }

  const reset: Reset = () => {
    teardown()
    setup()
  }

  interface SetState {
    (nextState: States): void
  }

  const setState: SetState = (nextState) => {
    state = nextState
    dispatch({ type: STATE, value: state })
  }

  const setup = () => {
    // setup modal container
    modalContainerEl = createElement(DIV) as HTMLDivElement
    setAttribute(DATA_RMIZ_CONTAINER, '', modalContainerEl)
    setStyleProp('zIndex', `${zIndex}`, modalContainerEl)

    // setup modal overlay
    modalOverlayEl = createElement(DIV) as HTMLDivElement
    setAttribute(DATA_RMIZ_OVERLAY, '', modalOverlayEl)
    setAttribute(
      STYLE,
      'position:fixed;top:0;right:0;bottom:0;left:0;' +
        `background-color:${overlayBgColor};` +
        `transition-duration:${transitionDuration}ms;` +
        'transition-property:opacity;opacity:0;will-change:opacity;' +
        styleCursorZoomOut,
      modalOverlayEl
    )

    // setup modal boundary start
    modalBoundaryStartEl = createElement(DIV) as HTMLDivElement
    setAttribute(TABINDEX, ZERO_STR, modalBoundaryStartEl)

    // setup modal boundary stop
    modalBoundaryStopEl = createElement(DIV) as HTMLDivElement
    setAttribute(TABINDEX, ZERO_STR, modalBoundaryStopEl)

    // setup dialog
    modalDialogEl = createElement(DIV) as HTMLDivElement
    setAttribute(ARIA_LABELLED_BY, ID_RMIZ_MODAL_LABEL, modalDialogEl)
    setAttribute(ARIA_MODAL, 'true', modalDialogEl)
    setAttribute(DATA_RMIZ_DIALOG, '', modalDialogEl)
    setAttribute(ROLE, DIALOG, modalDialogEl)
    setAttribute(TABINDEX, ZERO_STR, modalDialogEl)

    // setup dialog close button
    modalDialogUnzoomBtnEl = createElement(BUTTON) as HTMLButtonElement

    // setup dialog label
    modalDialogLabelEl = createElement(DIV) as HTMLDivElement
    setAttribute(STYLE, styleVisuallyHidden, modalDialogLabelEl)
    setAttribute(ID, ID_RMIZ_MODAL_LABEL, modalDialogLabelEl)
    setInnerText(modalDialogLabelEl, zoomTitle)

    // add label & close button to dialog
    appendChild(modalDialogUnzoomBtnEl, modalDialogEl)
    appendChild(modalDialogLabelEl, modalDialogEl)
    //appendChild(modalDialogImgEl, modalDialogEl)

    // add items to container
    appendChild(modalOverlayEl, modalContainerEl)
    appendChild(modalBoundaryStartEl, modalContainerEl)
    appendChild(modalDialogEl, modalContainerEl)
    appendChild(modalBoundaryStopEl, modalContainerEl)
  }

  const teardown: Teardown = () => {
    // detach all automatically tracked elements
    for (const trackedEl of trackedEls) {
      detach(trackedEl, true)
    }

    // cleanup zoom bits
    teardownZoom()

    // cleanup variables
    modalBoundaryStartEl = undefined
    modalBoundaryStopEl = undefined
    modalContainerEl = undefined
    modalDialogUnzoomBtnEl = undefined
    modalDialogEl = undefined
    modalDialogLabelEl = undefined
    modalOverlayEl = undefined
    trackedEls = []

    // update state to unzoomed
    setState(UNZOOMED)
  }

  const teardownZoom = (): void => {
    // cleanup window resize listener
    removeEventListener(RESIZE, handleResize, win)

    // cleanup modal click
    if (modalContainerEl) {
      removeEventListener(CLICK, handleModalClick, modalContainerEl)
    }

    // cleanup listener on boundary start el
    if (modalBoundaryStartEl) {
      removeEventListener(FOCUS, handleFocusBoundaryDiv, modalBoundaryStartEl)
    }

    // cleanup listener on boundary stop el
    if (modalBoundaryStopEl) {
      removeEventListener(FOCUS, handleFocusBoundaryDiv, modalBoundaryStopEl)
    }

    if (modalContainerEl) {
      removeChild(modalContainerEl, documentBody)
    }
  }

  // update the instance's options
  const update: Update = (opts = {}) => {
    auto = opts.auto ?? auto
    margin = opts.margin ?? margin
    onChange = opts.onChange ?? onChange
    overlayBgColor = opts.overlayBgColor ?? overlayBgColor
    overlayOpacity = opts.overlayOpacity ?? overlayOpacity
    transitionDuration = opts.transitionDuration ?? transitionDuration
    unzoomLabel = opts.unzoomLabel ?? unzoomLabel
    zIndex = opts.zIndex ?? zIndex
    zoomLabel = opts.zoomLabel ?? zoomLabel
    zoomTitle = opts.zoomTitle ?? zoomTitle

    if (modalContainerEl) {
      setStyleProp('zIndex', `${zIndex}`, modalContainerEl)
    }

    if (modalOverlayEl) {
      if (isNotNil(opts.overlayBgColor)) {
        setStyleProp(BG_COLOR, overlayBgColor, modalOverlayEl)
      }

      if (isNotNil(opts.overlayOpacity)) {
        setStyleProp(OPACITY, `${overlayOpacity}`, modalOverlayEl)
      }

      if (isNotNil(opts.transitionDuration)) {
        setStyleProp(
          TRANSITION_DURATION,
          `${transitionDuration}`,
          modalOverlayEl
        )
      }
    }

    if (modalDialogLabelEl) {
      modalDialogLabelEl.innerText = zoomTitle
    }

    if (modalDialogUnzoomBtnEl) {
      modalDialogUnzoomBtnEl.innerText = unzoomLabel
    }
  }

  const unzoom: Unzoom = () => {
    setState(UNZOOMING)
    teardownZoom()
    setState(UNZOOMED)
  }

  const zoom: Zoom = (el) => {
    if (el instanceof HTMLImageElement) {
      setState(ZOOMING)

      const { height, left, top, width } = getBoundingClientRect(el)
      const { naturalHeight, naturalWidth } = el
      const oldTransform = getStyleProperty(TRANSFORM, el)
      const oldTransformVal = oldTransform ? ` ${oldTransform}` : ''
      const scale = getScaleToWindowMax(
        width,
        naturalWidth,
        height,
        naturalHeight,
        margin
      )
      const topOffset = getWindowPageYOffset()
      const leftOffset = getWindowPageXOffset()

      // Get the the coords for center of the viewport
      const viewportX = getWindowInnerWidth() / 2
      const viewportY = getWindowInnerHeight() / 2

      // Get the coords for center of the parent item
      //const childCenterX = left + width / 2
      //const childCenterY = top + height / 2

      // Get offset amounts for item coords to be centered on screen
      const translateX = -left  //(viewportX - childCenterX) / scale
      const translateY = 0  //(viewportY - childCenterY) / scale

      // Build transform style, including any old transform
      const zoomTransform =
        `scale(1) translate3d(${translateX}px,${translateY}px,0)` +
          oldTransformVal

      console.log({
        height,
        left,
        top,
        width,
        naturalWidth,
        naturalHeight,
        scale,
      })

      // clone image and set up
      modalDialogImgEl = createElement(IMG) as HTMLImageElement
      setAttribute(ALT, el.alt, modalDialogImgEl)
      setAttribute(SRC, el.currentSrc, modalDialogImgEl)
      setAttribute(DATA_RMIZ_DIALOG_IMG, '', modalDialogImgEl)

      if (!modalContainerEl || !modalDialogEl || !modalDialogImgEl) {
        return
      }

      setAttribute(
        STYLE,
        stylePositionAbsolute +
        `top:${topOffset + top}px;` +
        `left:${leftOffset + left}px;` +
        `height:${height * scale}px;` +
        `width:${width * scale}px;` +
        `transform:scale(${1/scale}) translate3d(0,0,0)` + oldTransformVal + ';' +
        `transition:transform ${transitionDuration}ms cubic-bezier(0.2,0,0.2,1);` +
        'transform-origin:top left;' +
        styleCursorZoomOut,
        modalDialogImgEl
      )

      // add image to modal dialog
      appendChild(modalDialogImgEl, modalDialogEl)

      // append modal container to DOM
      appendChild(modalContainerEl, documentBody)

      // listen for window resize
      addEventListener(RESIZE, handleResize, win)

      // listen for keydown
      addEventListener(KEYDOWN, handleDocumentKeyDown, document)

      // listen for modal click
      if (modalContainerEl) {
        addEventListener(CLICK, handleModalClick, modalContainerEl)
      }

      // listen for focus on the modal boundary start
      if (modalBoundaryStartEl) {
        addEventListener(FOCUS, handleFocusBoundaryDiv, modalBoundaryStartEl)
      }

      // listen for focus on the modal boundary stop
      if (modalBoundaryStopEl) {
        addEventListener(FOCUS, handleFocusBoundaryDiv, modalBoundaryStopEl)
      }

      //raf(() => {
      //  setTimeout(() => {
      //    if (modalOverlayEl) {
      //      // reveal overlay
      //      setStyleProp(OPACITY, '1', modalOverlayEl)
      //    }
      //  }, 0)
      //})

      raf(() => {
        setTimeout(() => {
          if (el && modalDialogImgEl) {
            // hide original image
            //setStyleProp(VISIBILITY, HIDDEN, el)

            // perform zoom transform
            setStyleProp(TRANSFORM, zoomTransform, modalDialogImgEl)

            // @TODO: on animationend
            setState(ZOOMED)
          }
        }, 0)
      })
    }

    if (el instanceof SVGElement) {
      console.log('GOT AN SVG HERE!')
    }
  }

  const handleDocumentKeyDown = (e: KeyboardEvent): void => {
    if (isEscapeKey(e)) {
      stopPropagation(e)

      dispatch({ type: ACTION, value: UNZOOM })

      if (auto) {
        unzoom()
      }
    }
  }

  const handleFocusBoundaryDiv = (): void => {
    focusPreventScroll(modalDialogUnzoomBtnEl)
  }

  const handleImgClick = (e: Event) => {
    dispatch({ type: ACTION, value: ZOOM })

    if (auto) {
      zoom(e.currentTarget)
    }
  }

  const handleModalClick = () => {
    console.log('MODAL CLICKED!')

    dispatch({ type: ACTION, value: UNZOOM })

    if (auto) {
      unzoom()
    }
  }

  const handleResize = () => {
    if (state === ZOOMED) {
      dispatch({ type: ACTION, value: UNZOOM })

      if (auto) {
        unzoom()
      }
    }
  }

  const handleZoomBtnBlur = (e: Event) => {
    setAttribute(
      STYLE,
      styleZoomBtnHidden,
      e.currentTarget as HTMLButtonElement
    )
  }

  const handleZoomBtnFocus = (e: Event) => {
    setAttribute(
      STYLE,
      styleAppearanceNone +
        styleCursorZoomIn +
        stylePositionAbsolute +
        'padding:3px;' +
        'width:30px;' +
        'height:30px;' +
        'background:#fff;' +
        'border:none;' +
        'fill:#707070;' +
        'transform:translateX(-100%);',
      e.currentTarget as HTMLButtonElement
    )
  }

  const handleZoomBtnClick = (e: Event) => {
    const zoomBtnEl = e.currentTarget as HTMLButtonElement
    const imgEl = getPreviousSibling(zoomBtnEl)

    if (imgEl instanceof HTMLImageElement) {
      dispatch({ type: ACTION, value: ZOOM })

      if (auto) {
        zoom(imgEl as HTMLImageElement)
      }
    }
  }

  setup()

  return {
    attach,
    detach,
    reset,
    teardown,
    unzoom,
    update,
    zoom,
  }
}


// HELPERS

const focusPreventScroll = focus.bind(null, { preventScroll: true })

//interface isSVG {
//  (x: unknown): boolean
//}
//const isSVG: isSVG = (x) => x instanceof SVGElement

//interface isImg {
//  (x: unknown): boolean
//}
//const isImg: isImg = (x) => x instanceof HTMLImageElement

interface IsNotNil {
  (x: unknown): boolean
}
const isNotNil: IsNotNil = x => x != null

const setStyleProp = setStyleProperty.bind(null, undefined)


  //const isImgEl = targetEl.tagName === 'IMG'
  //const isSvgSrc = isImgEl && SVG_REGEX.test(
  //  (targetEl as HTMLImageElement).currentSrc
  //)
  //const isImg = !isSvgSrc && isImgEl
  //const documentBody = document.body
  //const scrollableEl = window

  //let ariaHiddenSiblings: [HTMLElement, string][] = []
  //let boundaryDivFirst: HTMLDivElement | undefined
  //let boundaryDivLast: HTMLDivElement | undefined
  //let closeBtnEl: HTMLButtonElement | undefined
  //let modalEl: HTMLDivElement | undefined
  //let motionPref: MediaQueryList | undefined
  //let openBtnEl: HTMLButtonElement | undefined
  //let overlayEl: HTMLDivElement | undefined
  //let state: State = UNLOADED
  //let transitionDuration = _transitionDuration
  //let zoomableEl: HTMLElement | undefined

  //const init = (): void => {
  //  addEventListener(RESIZE, handleResize, window)

  //  initMotionPref()

  //  if (isImgEl && !(targetEl as HTMLImageElement).complete) {
  //    addEventListener(LOAD, handleLoad, targetEl)
  //  } else {
  //    handleLoad()
  //  }
  //}

  //// START TARGET MUTATION OBSERVER

  //let bodyObserver: MutationObserver | undefined
  //let oldTargetEl = targetEl.cloneNode(true)

  //const initMutationObservers = (): void => {
  //  const opts = {
  //    attributes: true,
  //    characterData: true,
  //    childList: true,
  //    subtree: true,
  //  }

  //  const bodyCb = (): void => {
  //    if (targetEl) {
  //      if (state === UNLOADED && !oldTargetEl.isEqualNode(targetEl)) {
  //        reset()
  //        oldTargetEl = targetEl.cloneNode(true)
  //      }
  //    }
  //  }

  //  bodyObserver = new MutationObserver(bodyCb)
  //  bodyObserver.observe(documentBody, opts)
  //}

  //const cleanupMutationObservers = (): void => {
  //  bodyObserver?.disconnect()
  //  bodyObserver = undefined
  //}

  //// END TARGET MUTATION OBSERVER

  //// START MOTION PREFS

  //const initMotionPref = (): void => {
  //  motionPref = window.matchMedia('(prefers-reduced-motion:reduce)')
  //  motionPref.addListener(handleMotionPref) // NOT addEventListener because compatibility
  //}

  //const handleMotionPref = (): void => {
  //  transitionDuration = 0
  //}

  //const cleanupMotionPref = (): void => {
  //  motionPref?.removeListener(handleMotionPref) // NOT removeEventListener because compatibility
  //  motionPref = undefined
  //}

  //// END MOTION PREFS

  //const handleLoad = (): void => {
  //  if (!targetEl || state !== UNLOADED) return

  //  const { height, width } = getBoundingClientRect(targetEl)
  //  const { naturalHeight, naturalWidth } = targetEl as HTMLImageElement

  //  const currentScale = isImg && naturalHeight && naturalWidth
  //    ? getScaleToWindowMax(
  //        width,
  //        naturalWidth,
  //        height,
  //        naturalHeight,
  //        zoomMargin
  //      )
  //    : getScaleToWindow(width, height, zoomMargin)

  //  if (currentScale > 1) {
  //    // create openBtnEl
  //    openBtnEl = createElement(BUTTON) as HTMLButtonElement
  //    setAttribute(ARIA_LABEL, openText, openBtnEl)
  //    setAttribute(STYLE, styleZoomBtnIn, openBtnEl)
  //    setAttribute(TYPE, BUTTON, openBtnEl)
  //    adjustOpenBtnEl()
  //    addEventListener(CLICK, handleOpenBtnClick, openBtnEl)

  //    // insert openBtnEl after targetEl
  //    targetEl.insertAdjacentElement('afterend', openBtnEl)

  //  } else {
  //    cleanupZoom()
  //    cleanupDOMMutations()
  //  }

  //  initMutationObservers()
  //}

  //const reset = (): void => {
  //  cleanup()
  //  init()
  //}

  //const adjustOpenBtnEl = () => {
  //  if (!openBtnEl) return

  //  const { height, width } = getBoundingClientRect(targetEl)
  //  const style = getComputedStyle(targetEl)
  //  const type = style[DISPLAY]
  //  const marginLeft = parseFloat(style[MARGIN_LEFT_JS as any]) // eslint-disable-line @typescript-eslint/no-explicit-any
  //  const marginTop = parseFloat(style[MARGIN_TOP_JS as any]) // eslint-disable-line @typescript-eslint/no-explicit-any

  //  setStyleProperty(undefined, WIDTH, `${width}px`, openBtnEl)
  //  setStyleProperty(undefined, HEIGHT, `${height}px`, openBtnEl)
  //  setStyleProperty(undefined, MARGIN_LEFT_JS, `${marginLeft}px`, openBtnEl)

  //  if (
  //    type === BLOCK ||
  //    type === 'flex' ||
  //    type === 'grid' ||
  //    type === 'table'
  //  ) {
  //    setStyleProperty(undefined, MARGIN_TOP_JS, `-${marginTop + height}px`, openBtnEl)
  //  } else {
  //    setStyleProperty(undefined, MARGIN_LEFT_JS, `${marginLeft - width}px`, openBtnEl)
  //  }
  //}

  //const update: Update = (opts = {}) => {
  //  if (opts.closeText) closeText = opts.closeText
  //  if (opts.modalText) modalText = opts.modalText
  //  if (opts.openText) openText = opts.openText
  //  if (opts.overlayBgColor) overlayBgColor = opts.overlayBgColor
  //  if (opts.overlayOpacity) overlayOpacity = opts.overlayOpacity
  //  if (opts.transitionDuration) transitionDuration = opts.transitionDuration
  //  if (opts.zoomMargin) zoomMargin = opts.zoomMargin
  //  if (opts.zoomZindex) zoomZindex = opts.zoomZindex

  //  setZoomImgStyle(false)

  //  if (state === UNLOADED && opts.isZoomed) {
  //    zoom()
  //  } else if (state === LOADED && opts.isZoomed === false) {
  //    unzoom()
  //  }
  //}

  //// START CLEANUP

  //const cleanup = (): void => {
  //  cleanupZoom()
  //  cleanupMutationObservers()
  //  cleanupTargetLoad()
  //  cleanupDOMMutations()
  //  cleanupMotionPref()
  //  removeEventListener(RESIZE, handleResize, window)
  //}

  //const cleanupTargetLoad = (): void => {
  //  if (isImg && targetEl) {
  //    removeEventListener(LOAD, handleLoad, targetEl)
  //  }
  //}

  //const cleanupDOMMutations = (): void => {
  //  if (openBtnEl) {
  //    removeEventListener(CLICK, handleOpenBtnClick, openBtnEl)
  //    removeChild(openBtnEl, getParentNode(openBtnEl) as HTMLElement)
  //  }

  //  openBtnEl = undefined
  //}

  //const cleanupZoom = (): void => {
  //  removeEventListener(SCROLL, handleScroll, scrollableEl)
  //  removeEventListener(KEYDOWN, handleDocumentKeyDown, document)

  //  if (zoomableEl) {
  //    removeEventListener(LOAD, handleZoomImgLoad, zoomableEl)
  //    removeEventListener(TRANSITIONEND, handleUnzoomTransitionEnd, zoomableEl)
  //    removeEventListener(TRANSITIONEND, handleZoomTransitionEnd, zoomableEl)
  //  }

  //  if (closeBtnEl) {
  //    removeEventListener(CLICK, handleCloseBtnClick, closeBtnEl)
  //  }

  //  if (boundaryDivFirst) {
  //    removeEventListener(FOCUS, handleFocusBoundaryDiv, boundaryDivFirst)
  //  }

  //  if (boundaryDivLast) {
  //    removeEventListener(FOCUS, handleFocusBoundaryDiv, boundaryDivLast)
  //  }

  //  if (modalEl) {
  //    removeEventListener(CLICK, handleModalClick, modalEl)
  //    removeChild(modalEl, documentBody)
  //  }

  //  zoomableEl = undefined
  //  closeBtnEl = undefined
  //  boundaryDivFirst = undefined
  //  boundaryDivLast = undefined
  //  overlayEl = undefined
  //  modalEl = undefined
  //}

  //// END CLEANUP

  //const handleOpenBtnClick = (): void => {
  //  if (onZoomChange) {
  //    onZoomChange(true)
  //  }

  //  if (!isControlled) {
  //    zoom()
  //  }
  //}

  //const handleCloseBtnClick = (): void => {
  //  if (onZoomChange) {
  //    onZoomChange(false)
  //  }

  //  if (!isControlled) {
  //    unzoom()
  //  }
  //}

  //const handleFocusBoundaryDiv = (): void => {
  //  focusPreventScroll(closeBtnEl)
  //}

  //const handleResize = (): void => {
  //  if (state === LOADED) {
  //    setZoomImgStyle(true)
  //  } else {
  //    reset()
  //  }
  //}

  //const handleZoomTransitionEnd = (): void => {
  //  focusPreventScroll(closeBtnEl)
  //}

  //const handleZoomImgLoad = (): void => {
  //  if (!zoomableEl) return

  //  modalEl = createModal()

  //  if (!modalEl) return

  //  appendChild(modalEl, documentBody)

  //  addEventListener(KEYDOWN, handleDocumentKeyDown, document)
  //  addEventListener(SCROLL, handleScroll, scrollableEl)

  //  if (targetEl) {
  //    setStyleProperty(undefined, VISIBILITY, HIDDEN, targetEl)
  //  }

  //  if (zoomableEl) {
  //    addEventListener(TRANSITIONEND, handleZoomTransitionEnd, zoomableEl)
  //  }

  //  state = LOADED
  //  setZoomImgStyle(false)

  //  ariaHideOtherContent()

  //  if (overlayEl) {
  //    setAttribute(
  //      STYLE,
  //      stylePosAbsolute +
  //        styleAllDirsZero +
  //        `${BG_COLOR_CSS}:${overlayBgColor};` +
  //        `${TRANSITION}:${OPACITY} ${transitionDuration}ms ${styleTransitionTimingFn};` +
  //        `${OPACITY}:0;`,
  //      overlayEl
  //    )

  //    setStyleProperty(undefined, OPACITY, `${overlayOpacity}`, overlayEl)
  //  }
  //}

  //const handleUnzoomTransitionEnd = (): void => {
  //  if (targetEl) {
  //    setStyleProperty(undefined, VISIBILITY, '', targetEl)
  //  }

  //  state = UNLOADED
  //  setZoomImgStyle(true)

  //  cleanupZoom()

  //  focusPreventScroll(openBtnEl)
  //}

  //const handleModalClick = (): void => {
  //  if (onZoomChange) {
  //    onZoomChange(false)
  //  }

  //  if (!isControlled) {
  //    unzoom()
  //  }
  //}

  //const handleScroll = (): void => {
  //  if (state === LOADED) {
  //    if (onZoomChange) {
  //      onZoomChange(false)
  //    }

  //    if (!isControlled) {
  //      unzoom()
  //    }
  //  } else if (state === UNLOADING) {
  //    setZoomImgStyle(false)
  //  }
  //}

  //const handleDocumentKeyDown = (e: KeyboardEvent): void => {
  //  if (isEscapeKey(e)) {
  //    e.stopPropagation()

  //    if (onZoomChange) {
  //      onZoomChange(false)
  //    }

  //    if (!isControlled) {
  //      unzoom()
  //    }
  //  }
  //}

  //const setZoomImgStyle = (instant: boolean): void => {
  //  if (!targetEl || !zoomableEl) return

  //  const td = instant ? 0 : transitionDuration
  //  const { height, left, top, width } = targetEl.getBoundingClientRect()
  //  const originalTransform = getStyleProperty(TRANSFORM, targetEl)

  //  let transform: string

  //  if (state !== LOADED) {
  //    transform = 'scale(1) translate(0,0)' + (originalTransform ? ` ${originalTransform}` : '')
  //  } else {
  //    let scale = getScaleToWindow(width, height, zoomMargin)

  //    if (isImg) {
  //      const { naturalHeight, naturalWidth } = targetEl as HTMLImageElement

  //      if (naturalHeight && naturalWidth) {
  //        scale = getScaleToWindowMax(
  //          width,
  //          naturalWidth,
  //          height,
  //          naturalHeight,
  //          zoomMargin
  //        )
  //      }
  //    }

  //    // Get the the coords for center of the viewport
  //    const viewportX = getWindowInnerWidth() / 2
  //    const viewportY = getWindowInnerHeight() / 2

  //    // Get the coords for center of the parent item
  //    const childCenterX = left + width / 2
  //    const childCenterY = top + height / 2

  //    // Get offset amounts for item coords to be centered on screen
  //    const translateX = (viewportX - childCenterX) / scale
  //    const translateY = (viewportY - childCenterY) / scale

  //    // Build transform style, including any original transform
  //    transform =
  //      `scale(${scale}) translate(${translateX}px,${translateY}px)` +
  //      (originalTransform ? ` ${originalTransform}` : '')
  //  }

  //  setAttribute(
  //    STYLE,
  //    stylePosAbsolute +
  //      styleDisplayBlock +
  //      styleMaxWidth100pct +
  //      styleMaxHeight100pct +
  //      `${WIDTH}:${width}px;` +
  //      `${HEIGHT}:${height}px;` +
  //      `${LEFT}:${left}px;` +
  //      `${TOP}:${top}px;` +
  //      `${TRANSITION}:${TRANSFORM} ${td}ms ${styleTransitionTimingFn};` +
  //      `-webkit-${TRANSFORM}:${transform};` +
  //      `-ms-${TRANSFORM}:${transform};` +
  //      `${TRANSFORM}:${transform};`,
  //    zoomableEl
  //  )
  //}

  //const zoom = (): void => {
  //  if (isImgEl) {
  //    zoomImg()
  //  } else {
  //    zoomNonImg()
  //  }

  //  blur(openBtnEl)
  //}

  //const zoomImg = (): void => {
  //  if (!targetEl || state !== UNLOADED) return

  //  zoomableEl = cloneElement(true, targetEl) as HTMLImageElement
  //  removeAttribute(ID, zoomableEl)
  //  setAttribute(DATA_RMIZ_ZOOMED, '', zoomableEl)

  //  addEventListener(LOAD, handleZoomImgLoad, zoomableEl)
  //}

  //const zoomNonImg = (): void => {
  //  if (!targetEl || state !== UNLOADED) return

  //  zoomableEl = createElement(DIV) as HTMLDivElement
  //  setAttribute(DATA_RMIZ_ZOOMED, '', zoomableEl)
  //  setAttribute(STYLE, styleZoomStart, zoomableEl)

  //  const cloneEl = cloneElement(true, targetEl)
  //  removeAttribute(ID, cloneEl)
  //  setStyleProperty(undefined, MAX_WIDTH, NONE, cloneEl)
  //  setStyleProperty(undefined, MAX_HEIGHT, NONE, cloneEl)

  //  appendChild(cloneEl, zoomableEl)

  //  handleZoomImgLoad()
  //}

  //const createModal = (): HTMLDivElement | undefined => {
  //  if (!zoomableEl) return

  //  const el = createElement(DIV) as HTMLDivElement

  //  setAttribute(ARIA_LABEL, modalText, el)
  //  setAttribute(ARIA_MODAL, TRUE_STR, el)
  //  setAttribute(DATA_RMIZ_OVERLAY, '', el)
  //  setAttribute(ROLE, DIALOG, el)
  //  setAttribute(
  //    STYLE,
  //    `${POSITION}:fixed;` +
  //      styleAllDirsZero +
  //      styleWidth100pct +
  //      styleHeight100pct +
  //      `${Z_INDEX_CSS}:${zoomZindex};`,
  //    el
  //  )
  //  addEventListener(CLICK, handleModalClick, el)

  //  overlayEl = createElement(DIV) as HTMLDivElement

  //  boundaryDivFirst = createElement(DIV) as HTMLDivElement
  //  setAttribute(TABINDEX, ZERO, boundaryDivFirst)
  //  addEventListener(FOCUS, handleFocusBoundaryDiv, boundaryDivFirst)

  //  boundaryDivLast = createElement(DIV) as HTMLDivElement
  //  setAttribute(TABINDEX, ZERO, boundaryDivLast)
  //  addEventListener(FOCUS, handleFocusBoundaryDiv, boundaryDivLast)

  //  closeBtnEl = createElement(BUTTON) as HTMLButtonElement
  //  setAttribute(ARIA_LABEL, closeText, closeBtnEl)
  //  setAttribute(STYLE, styleZoomBtnOut, closeBtnEl)
  //  setAttribute(TYPE, BUTTON, el)
  //  addEventListener(CLICK, handleCloseBtnClick, closeBtnEl)

  //  appendChild(overlayEl, el)
  //  appendChild(boundaryDivFirst, el)
  //  appendChild(closeBtnEl, el)
  //  appendChild(zoomableEl, el)
  //  appendChild(boundaryDivLast, el)

  //  return el
  //}

  //const ariaHideOtherContent = (): void => {
  //  if (modalEl) {
  //    forEachSibling((el) => {
  //      if (isIgnoredElement(el)) return

  //      const ariaHiddenValue = getAttribute(ARIA_HIDDEN, el)

  //      if (ariaHiddenValue) {
  //        ariaHiddenSiblings.push([el, ariaHiddenValue])
  //      }

  //      el.setAttribute(ARIA_HIDDEN, TRUE_STR)
  //    }, modalEl)
  //  }
  //}

  //const ariaResetOtherContent = (): void => {
  //  if (modalEl) {
  //    forEachSibling((el) => {
  //      if (isIgnoredElement(el)) return

  //      removeAttribute(ARIA_HIDDEN, el)
  //    }, modalEl)
  //  }

  //  ariaHiddenSiblings.forEach(([el, ariaHiddenValue]) => {
  //    if (el) {
  //      setAttribute(ARIA_HIDDEN, ariaHiddenValue, el)
  //    }
  //  })

  //  ariaHiddenSiblings = []
  //}

  //const unzoom = (): void => {
  //  if (state === LOADED) {
  //    blur(closeBtnEl)

  //    ariaResetOtherContent()

  //    if (zoomableEl) {
  //      addEventListener(TRANSITIONEND, handleUnzoomTransitionEnd, zoomableEl)
  //    }

  //    state = UNLOADING
  //    setZoomImgStyle(false)

  //    if (overlayEl) {
  //      setStyleProperty(undefined, OPACITY, ZERO, overlayEl)
  //    }
  //  } else {
  //    setZoomImgStyle(false)
  //  }
  //}

  //init()

  //return { cleanup, update }
//}

export default imageZoom

//
// STRINGS
//

const PREFIX = 'rmiz'
const DATA_PREFIX = `data-${PREFIX}`

const ACTION = 'ACTION'
const ALT = 'alt'
const ARIA_HIDDEN = 'aria-hidden'
const ARIA_LABEL = 'aria-label'
const ARIA_LABELLED_BY = 'aria-labelledby'
const ARIA_MODAL = 'aria-modal'
const BG_COLOR = 'background-color'
const BLUR = 'blur'
const BUTTON = 'button'
const CLICK = 'click'
const CLASS = 'class'
const CURSOR = 'cursor'
const DATA_RMIZ_CONTAINER = `${DATA_PREFIX}-container`
const DATA_RMIZ_DIALOG = `${DATA_PREFIX}-dialog`
const DATA_RMIZ_DIALOG_IMG = `${DATA_PREFIX}-dialog-img`
const DATA_RMIZ_OVERLAY = `${DATA_PREFIX}-overlay`
const DATA_RMIZ_ZOOM_BTN = `${DATA_PREFIX}-zoom-button`
const DIALOG = 'dialog'
const DIV = 'div'
const FOCUS = 'focus'
const HIDDEN = 'hidden'
const ID = 'id'
const ID_RMIZ_MODAL_LABEL = `${PREFIX}-modal-label`
const IMG = 'img'
const KEYDOWN = 'keydown'
const LEFT = 'left'
const LOAD = 'load'
const MARGIN = 'margin'
const MARGIN_LEFT_JS = 'marginLeft'
const MARGIN_TOP_JS = 'marginTop'
const MAX_HEIGHT = 'maxHeight'
const MAX_WIDTH = 'maxWidth'
const NONE = 'none'
const OPACITY = 'opacity'
const PATH = 'path'
const POSITION = 'position'
const RESIZE = 'resize'
const ROLE = 'role'
const SCROLL = 'scroll'
const SIZES = 'sizes'
const SRC = 'src'
const SRCSET = 'srcset'
const STATE = 'STATE'
const STYLE = 'style'
const SVG = 'svg'
const TABINDEX = 'tabindex'
const TOP = 'top'
const TRANSFORM = 'transform'
const TRANSITION = 'transition'
const TRANSITIONEND = 'transitionend'
const TRANSITION_DURATION = 'transition-duration'
const TYPE = 'type'
const VISIBILITY = 'visibility'
const VISIBLE = 'visible'
const WIDTH = 'width'
const ZERO_STR = '0'
const ZOOM_BTN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 489.3 489.3"><path d="M476.95 0H12.35C5.55 0 .15 5.5.15 12.2V235c0 6.8 5.5 12.2 12.2 12.2s12.3-5.5 12.3-12.2V24.5h440.2v440.2h-211.9c-6.8 0-12.3 5.5-12.3 12.3s5.5 12.3 12.3 12.3h224c6.8 0 12.3-5.5 12.3-12.3V12.3c0-6.8-5.5-12.3-12.3-12.3z"/><path d="M.05 476.9c0 6.8 5.5 12.3 12.2 12.3h170.4c6.8 0 12.3-5.5 12.3-12.3V306.6c0-6.8-5.5-12.3-12.3-12.3H12.35c-6.8 0-12.2 5.5-12.2 12.3v170.3h-.1zm24.5-158.1h145.9v145.9H24.55V318.8zM222.95 266.3c2.4 2.4 5.5 3.6 8.7 3.6s6.3-1.2 8.7-3.6l138.6-138.7v79.9c0 6.8 5.5 12.3 12.3 12.3s12.3-5.5 12.3-12.3V98.1c0-6.8-5.5-12.3-12.3-12.3h-109.5c-6.8 0-12.3 5.5-12.3 12.3s5.5 12.3 12.3 12.3h79.9L222.95 249c-4.8 4.8-4.8 12.5 0 17.3z"/></svg>'

//
// STYLING
//

const styleAppearanceNone = '-webkit-appearance:none;-moz-appearance:none;appearance:none;'
const styleCursorPointer = 'cursor:pointer;'
const styleCursorZoomIn = styleCursorPointer + `cursor:zoom-in;`
const styleCursorZoomOut = styleCursorPointer + `cursor:zoom-out;`
//const styleFastTap = 'touch-action:manipulation;'
const stylePositionAbsolute = 'position:absolute;'
//const styleVisibilityHidden = 'visibility:hidden;'
const styleVisuallyHidden = stylePositionAbsolute + 'clip:rect(0 0 0 0);clip-path:inset(50%);width:1px;height:1px;overflow:hidden;white-space:nowrap;'

const styleZoomBtnHidden =
  styleCursorZoomIn +
    stylePositionAbsolute +
    styleVisuallyHidden


//const styleZoomBtnBase =
//  stylePosAbsolute +
//  styleFastTap +
//  styleAppearanceNone +
//  'background:none;` +
//  'border:0;' +
//  'margin:0;' +
//  'padding:0;'

//const styleZoomBtnIn = styleZoomBtnBase + styleCursorZoomIn

//const styleZoomBtnOut =
//  styleZoomBtnBase +
//  styleAllDirsZero +
//  styleHeight100pct +
//  styleWidth100pct +
//  styleCursorZoomOut +
//  'z-index:1;'

//const styleZoomStart = stylePosAbsolute + styleVisibilityHidden

//
// HELPERS
//

const SVG_REGEX = /\.svg$/i

interface IsIgnoredElement {
  (el: HTMLElement): boolean
}

const isIgnoredElement: IsIgnoredElement = ({ tagName }) =>
  tagName === 'SCRIPT' || tagName === 'NOSCRIPT' || tagName === 'STYLE'
