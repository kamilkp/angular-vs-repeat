/**
 * Copyright Kamil Pękala http://github.com/kamilkp
 * Angular Virtual Scroll Repeat v2.0.13 2018/04/02
 */

/* global console, setTimeout, module */

((window, angular) => {
  /**
   * DESCRIPTION:
   * vsRepeat directive stands for Virtual Scroll Repeat. It turns a standard ngRepeated set of elements in a scrollable container
   * into a component, where the user thinks he has all the elements rendered and all he needs to do is scroll (without any kind of
   * pagination - which most users loath) and at the same time the browser isn't overloaded by that many elements/angular bindings etc.
   * The directive renders only so many elements that can fit into current container's clientHeight/clientWidth.

   * LIMITATIONS:
   * - current version only supports an Array as a right-hand-side object for ngRepeat
   * - all rendered elements must have the same height/width or the sizes of the elements must be known up front

   * USAGE:
   * In order to use the vsRepeat directive you need to place a vs-repeat attribute on a direct parent of an element with ng-repeat
   * example:
   * <div vs-repeat="options">
   *      <div ng-repeat="item in someArray">
   *          <!-- content -->
   *      </div>
   * </div>

   * or:
   * <div vs-repeat="options">
   *      <div ng-repeat-start="item in someArray">
   *          <!-- content -->
   *      </div>
   *      <div>
   *         <!-- something in the middle -->
   *      </div>
   *      <div ng-repeat-end>
   *          <!-- content -->
   *      </div>
   * </div>

   * You can also measure the single element's height/width (including all paddings and margins), and then speficy it as a value
   * of the option's `size` property. This can be used if one wants to override the automatically computed element size.
   * example:
   * <div vs-repeat="{size: 50}"> <!-- the specified element height is 50px -->
   *      <div ng-repeat="item in someArray">
   *          <!-- content -->
   *      </div>
   * </div>

   * IMPORTANT!

   * - the vsRepeat directive must be applied to a direct parent of an element with ngRepeat
   * - the value of vsRepeat attribute is the single element's height/width measured in pixels. If none provided, the directive
   *      will compute it automatically

   * OPTIONAL PARAMETERS (attributes):
   * vs-repeat-container="selector" - selector for element containing ng-repeat. (defaults to the current element)

   * OPTIONS:
   * Options shall be passed as an object to the `vs-repeat` attribute e.g.: `<div vs-repeat="{scrollParent: 'window', size: 20}"></div>`
   *
   * Available options:
   * `horizontal` - stack repeated elements horizontally instead of vertically
   * `offset-before` - top/left offset in pixels (defaults to 0)
   * `offset-after` - bottom/right offset in pixels (defaults to 0)
   * `scroll-margin` - how many pixels ahead should elements be rendered while scrolling
   * `latch` - if true, elements will be rendered gradually but won't be removed when scrolled away (defaults to false)

   * `size` - a property name of the items in collection that is a number denoting the element size (in pixels)
   * `autoresize` - use this attribute without vs-size and without specifying element's size. The automatically computed element style will
   *              readjust upon window resize if the size is dependable on the viewport size
   * `scrolled-to-end` - callback will be called when the last item of the list is rendered
   * `scrolled-to-end-offset` - set this number to trigger the scrolledToEnd callback n items before the last gets rendered
   * `scrolled-to-beginning` - callback will be called when the first item of the list is rendered
   * `scrolled-to-beginning-offset` - set this number to trigger the scrolledToBeginning callback n items before the first gets rendered

   * EVENTS:
   * - `vsRepeatTrigger` - an event the directive listens for to manually trigger reinitialization
   * - `vsRepeatReinitialized` - an event the directive emits upon reinitialization done
   */

  let closestElement = angular.element.prototype.closest;

  if (!closestElement) {
    const matchingFunction = [
      'matches',
      'matchesSelector',
      'webkitMatches',
      'webkitMatchesSelector',
      'msMatches',
      'msMatchesSelector',
      'mozMatches',
      'mozMatchesSelector',
    ].reduce((res, prop) => res ?? (prop in document.documentElement ? prop : null), null);

    closestElement = function(selector) {
      let el = this[0].parentNode;
      while (el !== document.documentElement && el != null && !el[matchingFunction](selector)) {
        el = el.parentNode;
      }

      if (el?.[matchingFunction](selector)) {
        return angular.element(el);
      }

      return angular.element();
    };
  }

  function getWindowScroll() {
    if ('pageYOffset' in window) {
      return {
        scrollTop: window.pageYOffset,
        scrollLeft: window.pageXOffset,
      };
    }

    return {
      scrollTop: document.documentElement.scrollTop ?? document.body.scrollTop ?? 0,
      scrollLeft: document.documentElement.scrollLeft ?? document.body.scrollLeft ?? 0,
    };
  }

  function getClientSize(element, sizeProp) {
    if (element === window) {
      return sizeProp === 'clientWidth' ? window.innerWidth : window.innerHeight;
    }

    return element[sizeProp];
  }

  function getScrollPos(element, scrollProp) {
    return element === window ? getWindowScroll()[scrollProp] : element[scrollProp];
  }

  function getScrollOffset(vsElement, scrollElement, isHorizontal) {
    const vsPos = vsElement.getBoundingClientRect()[isHorizontal ? 'left' : 'top'];
    const scrollPos = scrollElement === window ? 0 : scrollElement.getBoundingClientRect()[isHorizontal ? 'left' : 'top'];
    const scrollValue = (scrollElement === window ? getWindowScroll() : scrollElement)[isHorizontal ? 'scrollLeft' : 'scrollTop'];
    return vsPos - scrollPos + scrollValue;
  }

  function analyzeNgRepeatUsage(element) {
    const options = [
      'ng-repeat',
      'data-ng-repeat',
      'ng-repeat-start',
      'data-ng-repeat-start',
    ];

    for (const opt of options) {
      if (element.attr(opt)) {
        return [opt, element.attr(opt), opt.indexOf('-start') >= 0];
      }
    }

    throw new Error('angular-vs-repeat: no ng-repeat directive on a child element');
  }

  function printDeprecationWarning($element, message) {
    console.warn(`vs-repeat deprecation: ${message}`, $element[0]);
  }

  function attrDeprecated(attrname, $element) {
    printDeprecationWarning($element, `${attrname} attribute is deprecated. Pass the options object to vs-repeat attribute instead https://github.com/kamilkp/angular-vs-repeat#options`);
  }

  const defaultOptions = {
    latch: false,
    preserveLatchOnRefresh: false,
    container: null,
    scrollParent: null,
    size: null,
    offsetBefore: 0,
    offsetAfter: 0,
    scrolledToBeginning: angular.noop,
    scrolledToEnd: angular.noop,
    scrolledToBeginningOffset: 0,
    scrolledToEndOffset: 0,
    scrollMargin: 0,
    horizontal: false,
    autoresize: false,
    hunked: false,
    hunkSize: 0,
  };

  const vsRepeatModule = angular.module('vs-repeat', []).directive('vsRepeat', ['$compile', '$parse', function($compile, $parse) {
    return {
      restrict: 'A',
      scope: true,
      compile(compileElement, compileAttrs) {
        const compileRepeatContainer = 'vsRepeatContainer' in compileAttrs ? angular.element(compileElement[0].querySelector(compileAttrs.vsRepeatContainer)) : compileElement;
        const repeatContainerChildren = compileRepeatContainer.children();
        const ngRepeatChild = repeatContainerChildren.eq(0);
        let childCloneHtml = ngRepeatChild[0].outerHTML;
        const collectionName = '$vs_collection'; // TODO: make configurable?

        [
          'vsSize',
          'vsScrollParent',
          'vsSizeProperty',
          'vsHorizontal',
          'vsOffsetBefore',
          'vsOffsetAfter',
          'vsScrolledToEndOffset',
          'vsScrolledToBeginningOffset',
          'vsExcess',
          'vsScrollMargin',
        ].forEach((attrname) => {
          if (attrname in compileAttrs) {
            attrDeprecated(attrname, compileElement);
          }
        });

        const [originalNgRepeatAttr, ngRepeatExpression, isNgRepeatStart] = analyzeNgRepeatUsage(ngRepeatChild);

        const expressionMatches = /^\s*(\S+)\s+in\s+([\S\s]+?)(track\s+by\s+\S+)?$/.exec(ngRepeatExpression);
        const [, lhs, rhs, rhsSuffix] = expressionMatches;

        if (isNgRepeatStart) {
          let index = 0;
          let repeaterElement = repeatContainerChildren.eq(index);
          while (repeaterElement.attr('ng-repeat-end') == null && repeaterElement.attr('data-ng-repeat-end') == null) {
            index++;
            repeaterElement = repeatContainerChildren.eq(index);
            childCloneHtml += repeaterElement[0].outerHTML;
          }
        }

        compileRepeatContainer.empty();
        return {
          pre: function($scope, $element, $attrs) {
            function _parseSize(options) {
              if (typeof options.size === 'number') {
                options.getSize = () => options.size;
              } else {
                const parsed = $parse(String(options.size));
                options.getSize = (item) => parsed($scope, { [lhs]: item });
              }
            }

            $scope.vsRepeat = {
              options: {
                ...defaultOptions,
                ...($scope.$eval($attrs.vsRepeat) ?? {}),
              },
            };

            const { options } = $scope.vsRepeat;
            _parseSize(options);

            const repeatContainer = angular.isDefined($attrs.vsRepeatContainer) ? angular.element($element[0].querySelector($attrs.vsRepeatContainer)) : $element;
            const childClone = angular.element(childCloneHtml);
            const childTagName = childClone[0].tagName.toLowerCase();
            let originalCollection = [];
            let originalLength;
            const $beforeContent = angular.element('<' + childTagName + ' class="vs-repeat-before-content"></' + childTagName + '>');
            const $afterContent = angular.element('<' + childTagName + ' class="vs-repeat-after-content"></' + childTagName + '>');
            let autosizingRequired = options.size === null;

            const $scrollParent = options.scrollParent ?
              options.scrollParent === 'window' ? angular.element(window) :
                closestElement.call(repeatContainer, options.scrollParent) : repeatContainer;
            const clientSize = options.horizontal ? 'clientWidth' : 'clientHeight';
            const offsetSize = options.horizontal ? 'offsetWidth' : 'offsetHeight';
            const scrollSize = options.horizontal ? 'scrollWidth' : 'scrollHeight';
            const scrollPos = options.horizontal ? 'scrollLeft' : 'scrollTop';

            $scope.vsRepeat.totalSize = 0;

            if ($scrollParent.length === 0) {
              throw 'Specified scroll parent selector did not match any element';
            }

            $scope.vsRepeat.$scrollParent = $scrollParent;
            $scope.vsRepeat.sizesCumulative = [];

            if (options.debug) {
              const $debugParent = options.scrollParent === 'window' ? angular.element(document.body) : $scrollParent;
              const $debug = angular.element('<div class="vs-repeat-debug-element"></div>');
              $debug.css('position', options.scrollParent === 'window' ? 'fixed' : 'absolute');
              $debugParent.append($debug);

              $scope.$on('$destroy', () => {
                $debug.remove();
              });
            }

            let measuredSize = getClientSize($scrollParent[0], clientSize) || 50;

            if (options.horizontal) {
              $beforeContent.css('height', '100%');
              $afterContent.css('height', '100%');
            } else {
              $beforeContent.css('width', '100%');
              $afterContent.css('width', '100%');
            }

            if ($attrs.vsRepeatOptions) {
              $scope.$watchCollection($attrs.vsRepeatOptions, (newOpts) => {
                const mergedOptions = {
                  ...options,
                  ...newOpts,
                };

                if (JSON.stringify(mergedOptions) !== JSON.stringify(options)) {
                  Object.assign(options, newOpts);
                  _parseSize(options);
                  reinitialize();
                }
              });
            }

            $scope.$watchCollection(rhs, (coll = []) => {
              originalCollection = coll;
              refresh();
            });

            function refresh() {
              if (!originalCollection || originalCollection.length < 1) {
                $scope[collectionName] = [];
                originalLength = 0;
                $scope.vsRepeat.sizesCumulative = [0];
              } else {
                originalLength = originalCollection.length;
                if (options.size) {
                  _mapSize();
                } else {
                  getFromMeasured();
                }
              }

              reinitialize();
            }

            function _mapSize(hardSize = null) {
              const sizes = originalCollection.map(item => hardSize ?? options.getSize(item));
              let sum = 0;
              $scope.vsRepeat.sizesCumulative = [0, ...sizes.map((size) => (sum += size))];
            }

            function getFromMeasured() {
              if (autosizingRequired) {
                $scope.$$postDigest(() => {
                  if (repeatContainer[0].offsetHeight || repeatContainer[0].offsetWidth) { // element is visible
                    const children = repeatContainer.children();
                    let i = 0;
                    let gotSomething = false;
                    let insideStartEndSequence = false;

                    while (i < children.length) {
                      if (children[i].attributes[originalNgRepeatAttr] != null || insideStartEndSequence) {
                        if (!gotSomething) {
                          measuredSize = 0;
                        }

                        gotSomething = true;
                        if (children[i][offsetSize]) {
                          measuredSize += children[i][offsetSize];
                        }

                        if (isNgRepeatStart) {
                          if (children[i].attributes['ng-repeat-end'] != null || children[i].attributes['data-ng-repeat-end'] != null) {
                            break;
                          } else {
                            insideStartEndSequence = true;
                          }
                        } else {
                          break;
                        }
                      }
                      i++;
                    }

                    if (gotSomething) {
                      _mapSize(measuredSize);
                      reinitialize();
                      autosizingRequired = false;
                      if ($scope.$root && !$scope.$root.$$phase) {
                        $scope.$digest();
                      }
                    }
                  } else {
                    const dereg = $scope.$watch(() => {
                      if (repeatContainer[0].offsetHeight || repeatContainer[0].offsetWidth) {
                        dereg();
                        getFromMeasured();
                      }
                    });
                  }
                });
              } else {
                _mapSize(measuredSize);
              }
            }

            function getLayoutProps(value) {
              const layoutProp = options.horizontal ? 'width' : 'height';
              return ['', 'min-', 'max-'].reduce((acc, prop) =>
                (acc[`${prop}${layoutProp}`] = value, acc)
                , {});
            }

            childClone.eq(0).attr(originalNgRepeatAttr, lhs + ' in ' + collectionName + (rhsSuffix ? ' ' + rhsSuffix : ''));
            childClone.addClass('vs-repeat-repeated-element');

            repeatContainer.append($beforeContent);
            repeatContainer.append(childClone);
            $compile(childClone)($scope);
            repeatContainer.append($afterContent);

            $scope.vsRepeat.startIndex = 0;
            $scope.vsRepeat.endIndex = 0;

            function scrollHandler() {
              const pos = $scrollParent[0][scrollPos];
              if (updateInnerCollection()) {
                $scope.$digest();

                if (options._ensureScrollIntegrity) {
                  $scrollParent[0][scrollPos] = pos;
                }
              }
            }

            $scrollParent.on('scroll', scrollHandler);

            setInterval(function(){
              $scope.$digest();
            }, 150);

            function onWindowResize() {
              if (options.autoresize) {
                autosizingRequired = true;
                getFromMeasured();
                if ($scope.$root && !$scope.$root.$$phase) {
                  $scope.$digest();
                }
              }

              if (updateInnerCollection()) {
                $scope.$digest();
              }
            }

            angular.element(window).on('resize', onWindowResize);
            $scope.$on('$destroy', () => {
              angular.element(window).off('resize', onWindowResize);
              $scrollParent.off('scroll', scrollHandler);
            });

            $scope.$on('vsRepeatTrigger', refresh);

            $scope.$on('vsRepeatResize', () => {
              autosizingRequired = true;
              getFromMeasured();
            });

            let _prevStartIndex,
              _prevEndIndex,
              _minStartIndex,
              _maxEndIndex;

            $scope.$on('vsRenderAll', function() {
              if (!options.latch) {
                return;
              }

              if ($scope.vsRepeat.endIndex === originalLength) {
                $scope.$emit('vsRenderAllDone');
                return;
              }

              setTimeout(() => {
                // var __endIndex = Math.min($scope.vsRepeat.endIndex + (quantum || 1), originalLength);
                const __endIndex = originalLength;
                _maxEndIndex = Math.max(__endIndex, _maxEndIndex);

                $scope.vsRepeat.endIndex = options.latch ? _maxEndIndex : __endIndex;
                $scope[collectionName] = originalCollection.slice($scope.vsRepeat.startIndex, $scope.vsRepeat.endIndex);

                _prevEndIndex = $scope.vsRepeat.endIndex;

                $beforeContent.css(getLayoutProps(0));
                $afterContent.css(getLayoutProps(0));

                $scope.$emit('vsRenderAllDone');
                if ($scope.$root && !$scope.$root.$$phase) {
                  $scope.$digest();
                }
              });
            });

            function reinitialize() {
              _prevStartIndex = void 0;
              _prevEndIndex = void 0;

              if (!options.preserveLatchOnRefresh || _minStartIndex === undefined || _maxEndIndex === undefined) {
                _minStartIndex = originalLength;
                _maxEndIndex = 0;
              }

              updateTotalSize($scope.vsRepeat.sizesCumulative[originalLength]);
              updateInnerCollection();

              $scope.$emit('vsRepeatReinitialized', $scope.vsRepeat.startIndex, $scope.vsRepeat.endIndex);
            }

            function updateTotalSize(size) {
              $scope.vsRepeat.totalSize = options.offsetBefore + size + options.offsetAfter;
            }

            let _prevClientSize;
            function reinitOnClientHeightChange() {
              const ch = getClientSize($scrollParent[0], clientSize);
              if (ch !== _prevClientSize) {
                reinitialize();
                if ($scope.$root && !$scope.$root.$$phase) {
                  $scope.$digest();
                }
              }
              _prevClientSize = ch;
            }

            $scope.$watch(() => {
              if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(reinitOnClientHeightChange);
              } else {
                reinitOnClientHeightChange();
              }
            });

            function binaryFind(array, threshold, a = 0, b = array.length - 1, d = 1) {
              if (array[a] === threshold) {
                return [a, a, d];
              }

              if (array[b] === threshold) {
                return [b, b, d];
              }

              if (b - a > 1) {
                const m = Math.floor((a + b) / 2);
                if (array[m] > threshold) {
                  return binaryFind(array, threshold, a, m, d + 1);
                }

                return binaryFind(array, threshold, m, b, d + 1);
              }

              return [
                threshold > array[b] ? b : a,
                threshold < array[a] ? a : b,
                d,
              ];
            }

            function updateInnerCollection() {
              const $scrollPosition = getScrollPos($scrollParent[0], scrollPos);
              let $clientSize = getClientSize($scrollParent[0], clientSize);

              if (options.debug) {
                $clientSize /= 2;
              }

              const scrollOffset = repeatContainer[0] === $scrollParent[0] ? 0 : getScrollOffset(
                repeatContainer[0],
                $scrollParent[0],
                options.horizontal,
              );

              let __startIndex = $scope.vsRepeat.startIndex;
              let __endIndex = $scope.vsRepeat.endIndex;

              if (autosizingRequired && !options.size) {
                __startIndex = 0;
                __endIndex = 1;
              } else {
                // _warnMismatch();

                const relativeScroll = $scrollPosition - options.offsetBefore - scrollOffset;

                ([__startIndex] = binaryFind($scope.vsRepeat.sizesCumulative, relativeScroll - options.scrollMargin));
                __startIndex = Math.max(__startIndex, 0);

                ([, __endIndex] = binaryFind($scope.vsRepeat.sizesCumulative, relativeScroll + options.scrollMargin + $clientSize, __startIndex));
                __endIndex = Math.min(__endIndex, originalLength);
              }

              _minStartIndex = Math.min(__startIndex, _minStartIndex);
              _maxEndIndex = Math.max(__endIndex, _maxEndIndex);

              $scope.vsRepeat.startIndex = options.latch ? _minStartIndex : __startIndex;
              $scope.vsRepeat.endIndex = options.latch ? _maxEndIndex : __endIndex;

              // Move to the end of the collection if we are now past it
              if (_maxEndIndex < $scope.vsRepeat.startIndex)
                $scope.vsRepeat.startIndex = _maxEndIndex;

              let digestRequired = false;
              if (_prevStartIndex == null) {
                digestRequired = true;
              } else if (_prevEndIndex == null) {
                digestRequired = true;
              }

              if (!digestRequired) {
                if (options.hunked) {
                  if (Math.abs($scope.vsRepeat.startIndex - _prevStartIndex) >= options.hunkSize ||
                                        ($scope.vsRepeat.startIndex === 0 && _prevStartIndex !== 0)) {
                    digestRequired = true;
                  } else if (Math.abs($scope.vsRepeat.endIndex - _prevEndIndex) >= options.hunkSize ||
                                        ($scope.vsRepeat.endIndex === originalLength && _prevEndIndex !== originalLength)) {
                    digestRequired = true;
                  }
                } else {
                  digestRequired = $scope.vsRepeat.startIndex !== _prevStartIndex || $scope.vsRepeat.endIndex !== _prevEndIndex;
                }
              }

              if (digestRequired) {
                $scope[collectionName] = originalCollection.slice($scope.vsRepeat.startIndex, $scope.vsRepeat.endIndex);

                // Emit the event
                $scope.$emit('vsRepeatInnerCollectionUpdated', $scope.vsRepeat.startIndex, $scope.vsRepeat.endIndex, _prevStartIndex, _prevEndIndex);

                let triggerIndex;
                if (options.scrolledToEnd) {
                  triggerIndex = originalCollection.length - options.scrolledToEndOffset;
                  if (($scope.vsRepeat.endIndex >= triggerIndex && _prevEndIndex < triggerIndex) || (originalCollection.length && $scope.vsRepeat.endIndex === originalCollection.length)) {
                    $scope.$eval(options.scrolledToEnd);
                  }
                }
                if (options.scrolledToBeginning) {
                  triggerIndex = options.scrolledToBeginningOffset;
                  if (($scope.vsRepeat.startIndex <= triggerIndex && _prevStartIndex > $scope.vsRepeat.startIndex)) {
                    $scope.$eval(options.scrolledToBeginning);
                  }
                }

                _prevStartIndex = $scope.vsRepeat.startIndex;
                _prevEndIndex = $scope.vsRepeat.endIndex;

                const o1 = $scope.vsRepeat.sizesCumulative[$scope.vsRepeat.startIndex] + options.offsetBefore;
                const o2 = $scope.vsRepeat.sizesCumulative[$scope.vsRepeat.startIndex + $scope[collectionName].length] + options.offsetBefore;
                const total = $scope.vsRepeat.totalSize;

                $beforeContent.css(getLayoutProps(o1 + 'px'));
                $afterContent.css(getLayoutProps((total - o2) + 'px'));
              }

              return digestRequired;
            }

            function _warnMismatch() {
              $scope.$$postDigest(() => {
                window.requestAnimationFrame(() => {
                  const expectedSize = $scope.vsRepeat.sizesCumulative[originalLength];
                  const compStyle = window.getComputedStyle(repeatContainer[0]);
                  const paddings = options.horizontal ?
                    ['paddingLeft', 'paddingRight']
                    : ['paddingTop', 'paddingBottom'];
                  const containerSize = repeatContainer[0][scrollSize] - paddings.reduce((acc, prop) => acc + Number(compStyle[prop].slice(0, -2)), 0);

                  if (expectedSize >= containerSize) {
                    if (repeatContainer[0][scrollSize] && expectedSize !== containerSize) {
                      console.warn('vsRepeat: size mismatch. Expected size ' + expectedSize + 'px whereas actual size is ' + containerSize + 'px. Fix vsSize on element:', $element[0]);
                    }
                  }
                });
              });
            }
          },
        };
      },
    };
  }]);

  angular.element(document.head).append(
    `<style id="angular-vs-repeat-style">
	  	.vs-repeat-debug-element {
        top: 50%;
        left: 0;
        right: 0;
        height: 1px;
        background: red;
        z-index: 99999999;
        box-shadow: 0 0 20px red;
      }

      .vs-repeat-debug-element + .vs-repeat-debug-element {
        display: none;
      }

      .vs-repeat-before-content,
      .vs-repeat-after-content {
        border: none !important;
        padding: 0 !important;
      }
    </style>`
  );

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = vsRepeatModule.name;
  }
})(window, window.angular);
