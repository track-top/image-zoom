import { useEffect, useRef } from 'react'
import { usePrevious } from 'react-use'
import { forEachSibling } from '@rpearce/ts-dom-fns'

export const ModalStatus = {
  UNLOADED: 'UNLOADED',
  LOADING: 'LOADING',
  LOADED: 'LOADED',
  ERROR: 'ERROR',
}

export interface IsIgnoredElement {
  (el: HTMLElement): boolean
}

const isIgnoredElement: IsIgnoredElement = ({ tagName }) =>
  tagName === 'SCRIPT' || tagName === 'NOSCRIPT' || tagName === 'STYLE'

export interface UseAriaHideSiblings {
  (target: HTMLElement, status: typeof ModalStatus)
}

const useAriaHideSiblings: UseAriaHideSiblings = (target, status) => {
  const ariaHiddenSiblings = useRef([])
  const prevStatus = usePrevious(status)

  useEffect(() => {
    if (!target) {
      return
    }

    // if activated, we want to store the siblings'
    // values for aria-hidden so we can add them
    // back later
    if (
      prevStatus === ModalStatus.UNLOADED &&
      status !== ModalStatus.UNLOADED
    ) {
      forEachSibling(el => {
        if (isIgnoredElement(el)) {
          return
        }

        const ariaHiddenValue = el.getAttribute('aria-hidden')

        if (ariaHiddenValue) {
          ariaHiddenSiblings.current.push([el, ariaHiddenValue])
        }

        el.setAttribute('aria-hidden', 'true')
      }, target)
    }

    // if deactivated, we want to wipe the aria-hidden
    // slate clean and then add back the stored
    // aria-hidden values (if there are any)
    if (
      prevStatus !== ModalStatus.UNLOADED &&
      status === ModalStatus.UNLOADED
    ) {
      forEachSibling(el => {
        if (isIgnoredElement(el)) {
          return
        }

        el.removeAttribute('aria-hidden')
      }, target)

      ariaHiddenSiblings.current.forEach(([el, ariaHiddenValue]) => {
        if (el) {
          el.setAttribute('aria-hidden', ariaHiddenValue)
        }
      })

      ariaHiddenSiblings.current = []
    }
  }, [prevStatus, status, target])
}

export default useAriaHideSiblings
