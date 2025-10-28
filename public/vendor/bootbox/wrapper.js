/* global bootbox */

require(['translator', 'bootbox'], function (shim, bootbox) {
  'use strict'

  // expose as global with a warning
  if (Object.defineProperty) {
    Object.defineProperty(window, 'bootbox', {
      configurable: true,
      enumerable: true,
      get: function () {
        console.warn('[deprecated] Accessing bootbox globally is deprecated. Use `require(["bootbox"], function (bootbox) { ... })` instead')
        return bootbox
      }
    })
  } else {
    window.bootbox = bootbox
  }

  bootbox.setDefaults({
    locale: config.userLang
  })

  const translator = shim.Translator.create()
  const dialog = bootbox.dialog
  const attrsToTranslate = ['placeholder', 'title', 'value', 'label']
  bootbox.dialog = function (options) {
    const show = options.show !== false
    options.show = false

    const $elem = dialog.call(bootbox, options)
    const element = $elem[0]

    if (/\[\[.+\]\]/.test(element.outerHTML)) {
      translator.translateInPlace(element, attrsToTranslate).then(function () {
        if (show) {
          $elem.modal('show')
        }
      })
    } else if (show) {
      $elem.modal('show')
    }

    return $elem
  }

  Promise.all([
    translator.translateKey('modules:bootbox.ok', []),
    translator.translateKey('modules:bootbox.cancel', []),
    translator.translateKey('modules:bootbox.confirm', [])
  ]).then(function (translations) {
    const lang = shim.getLanguage()
    bootbox.addLocale(lang, {
      OK: translations[0],
      CANCEL: translations[1],
      CONFIRM: translations[2]
    })

    bootbox.setLocale(lang)
  })
})
