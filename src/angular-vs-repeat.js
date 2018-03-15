/**
 * Copyright Kamil Pękala http://github.com/kamilkp
 * Angular Virtual Scroll Repeat v2.0.0 2018/03/15
 */

((window, angular) => {
  // DESCRIPTION:
  // vsRepeat directive stands for Virtual Scroll Repeat. It turns a standard ngRepeated set of elements in a scrollable container
  // into a component, where the user thinks he has all the elements rendered and all he needs to do is scroll (without any kind of
  // pagination - which most users loath) and at the same time the browser isn't overloaded by that many elements/angular bindings etc.
  // The directive renders only so many elements that can fit into current container's clientHeight/clientWidth.

  // LIMITATIONS:
  // - current version only supports an Array as a right-hand-side object for ngRepeat
  // - all rendered elements must have the same height/width or the sizes of the elements must be known up front

  // USAGE:
  // In order to use the vsRepeat directive you need to place a vs-repeat attribute on a direct parent of an element with ng-repeat
  // example:
  // <div vs-repeat>
  //      <div ng-repeat="item in someArray">
  //          <!-- content -->
  //      </div>
  // </div>
  //
  // or:
  // <div vs-repeat>
  //      <div ng-repeat-start="item in someArray">
  //          <!-- content -->
  //      </div>
  //      <div>
  //         <!-- something in the middle -->
  //      </div>
  //      <div ng-repeat-end>
  //          <!-- content -->
  //      </div>
  // </div>
  //
  // You can also measure the single element's height/width (including all paddings and margins), and then speficy it as a value
  // of the attribute 'vs-repeat'. This can be used if one wants to override the automatically computed element size.
  // example:
  // <div vs-repeat="50"> <!-- the specified element height is 50px -->
  //      <div ng-repeat="item in someArray">
  //          <!-- content -->
  //      </div>
  // </div>
  //
  // IMPORTANT!
  //
  // - the vsRepeat directive must be applied to a direct parent of an element with ngRepeat
  // - the value of vsRepeat attribute is the single element's height/width measured in pixels. If none provided, the directive
  //      will compute it automatically

  // OPTIONAL PARAMETERS (attributes):
  // vs-repeat-container="selector" - selector for element containing ng-repeat. (defaults to the current element)
  // vs-scroll-parent="selector" - selector to the scrollable container. The directive will look for a closest parent matching
  //                              the given selector (defaults to the current element)
  // vs-horizontal - stack repeated elements horizontally instead of vertically
  // vs-offset-before="value" - top/left offset in pixels (defaults to 0)
  // vs-offset-after="value" - bottom/right offset in pixels (defaults to 0)
  // vs-excess="value" - an integer number representing the number of elements to be rendered outside of the current container's viewport
  //                      (defaults to 2)
  // vs-size - a property name of the items in collection that is a number denoting the element size (in pixels)
  // vs-autoresize - use this attribute without vs-size and without specifying element's size. The automatically computed element style will
  //              readjust upon window resize if the size is dependable on the viewport size
  // vs-scrolled-to-end="callback" - callback will be called when the last item of the list is rendered
  // vs-scrolled-to-end-offset="integer" - set this number to trigger the scrolledToEnd callback n items before the last gets rendered
  // vs-scrolled-to-beginning="callback" - callback will be called when the first item of the list is rendered
  // vs-scrolled-to-beginning-offset="integer" - set this number to trigger the scrolledToBeginning callback n items before the first gets rendered

  // EVENTS:
  // - 'vsRepeatTrigger' - an event the directive listens for to manually trigger reinitialization
  // - 'vsRepeatReinitialized' - an event the directive emits upon reinitialization done

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
        scrollTop: pageYOffset,
        scrollLeft: pageXOffset,
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

  const vsRepeatModule = angular.module('vs-repeat', []).directive('vsRepeat', ['$compile', '$parse', function($compile, $parse) {
    return {
      restrict: 'A',
      scope: true,
      compile($element, $attrs) {
        const repeatContainer = 'vsRepeatContainer' in $attrs ? angular.element($element[0].querySelector($attrs.vsRepeatContainer)) : $element;
        const repeatContainerChildren = repeatContainer.children();
        const ngRepeatChild = repeatContainerChildren.eq(0);
        let childCloneHtml = ngRepeatChild[0].outerHTML;
        const collectionName = '$vs_collection'; // TODO: make configurable?
        const attributesDictionary = {
          'vsRepeat': 'elementSize',
          'vsOffsetBefore': 'offsetBefore',
          'vsOffsetAfter': 'offsetAfter',
          'vsScrolledToEndOffset': 'scrolledToEndOffset',
          'vsScrolledToBeginningOffset': 'scrolledToBeginningOffset',
          'vsExcess': 'excess',
          'vsScrollMargin': 'scrollMargin',
        };

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

        repeatContainer.empty();
        return {
          pre: function($scope, $element, $attrs) {
            let repeatContainer = angular.isDefined($attrs.vsRepeatContainer) ? angular.element($element[0].querySelector($attrs.vsRepeatContainer)) : $element,
              childClone = angular.element(childCloneHtml),
              childTagName = childClone[0].tagName.toLowerCase(),
              originalCollection = [],
              originalLength,
              $$horizontal = typeof $attrs.vsHorizontal !== 'undefined',
              $beforeContent = angular.element('<' + childTagName + ' class="vs-repeat-before-content"></' + childTagName + '>'),
              $afterContent = angular.element('<' + childTagName + ' class="vs-repeat-after-content"></' + childTagName + '>'),
              autoSize = !$attrs.vsRepeat && !$attrs.vsSize,
              sizesPropertyExists = !!$attrs.vsSize || !!$attrs.vsSizeProperty,
              $scrollParent = $attrs.vsScrollParent ?
                $attrs.vsScrollParent === 'window' ? angular.element(window) :
                  closestElement.call(repeatContainer, $attrs.vsScrollParent) : repeatContainer,
              $$options = 'vsOptions' in $attrs ? $scope.$eval($attrs.vsOptions) : {},
              clientSize = $$horizontal ? 'clientWidth' : 'clientHeight',
              offsetSize = $$horizontal ? 'offsetWidth' : 'offsetHeight',
              scrollSize = $$horizontal ? 'scrollWidth' : 'scrollHeight',
              scrollPos = $$horizontal ? 'scrollLeft' : 'scrollTop';

            $scope.totalSize = 0;
            if (!('vsSize' in $attrs) && 'vsSizeProperty' in $attrs) {
              console.warn('vs-size-property attribute is deprecated. Please use vs-size attribute which also accepts angular expressions.');
            }

            if ($scrollParent.length === 0) {
              throw 'Specified scroll parent selector did not match any element';
            }
            $scope.$scrollParent = $scrollParent;

            if (sizesPropertyExists) {
              $scope.sizesCumulative = [];
            }

            if ($attrs.vsDebug === 'true') {
              const $debugParent = $attrs.vsScrollParent === 'window' ? angular.element(document.body) : $scrollParent;
              const $debug = angular.element('<div class="vs-repeat-debug-element"></div>');
              $debug.css('position', $attrs.vsScrollParent === 'window' ? 'fixed' : 'absolute');
              $debugParent.append($debug);

              $scope.$on('$destroy', () => {
                $debug.remove();
              });
            }

            //initial defaults
            $scope.elementSize = (+$attrs.vsRepeat) || getClientSize($scrollParent[0], clientSize) || 50;
            $scope.offsetBefore = 0;
            $scope.offsetAfter = 0;
            $scope.scrollMargin = 0;
            $scope.excess = 2;

            if ($$horizontal) {
              $beforeContent.css('height', '100%');
              $afterContent.css('height', '100%');
            } else {
              $beforeContent.css('width', '100%');
              $afterContent.css('width', '100%');
            }

            Object.keys(attributesDictionary).forEach(function(key) {
              if ($attrs[key]) {
                $attrs.$observe(key, function(value) {
                  // '+' serves for getting a number from the string as the attributes are always strings
                  $scope[attributesDictionary[key]] = +value;
                  reinitialize();
                });
              }
            });


            $scope.$watchCollection(rhs, function(coll) {
              originalCollection = coll || [];
              refresh();
            });

            function refresh() {
              if (!originalCollection || originalCollection.length < 1) {
                $scope[collectionName] = [];
                originalLength = 0;
                $scope.sizesCumulative = [0];
              } else {
                originalLength = originalCollection.length;
                if (sizesPropertyExists) {
                  $scope.sizes = originalCollection.map(function(item) {
                    const s = $scope.$new(false);
                    angular.extend(s, item);
                    s[lhs] = item;
                    const size = ($attrs.vsSize || $attrs.vsSizeProperty) ?
                      s.$eval($attrs.vsSize || $attrs.vsSizeProperty) :
                      $scope.elementSize;
                    s.$destroy();
                    return size;
                  });
                  let sum = 0;
                  $scope.sizesCumulative = $scope.sizes.map(function(size) {
                    const res = sum;
                    sum += size;
                    return res;
                  });
                  $scope.sizesCumulative.push(sum);
                } else {
                  setAutoSize();
                }
              }

              reinitialize();
            }

            function setAutoSize() {
              if (autoSize) {
                $scope.$$postDigest(function() {
                  if (repeatContainer[0].offsetHeight || repeatContainer[0].offsetWidth) { // element is visible
                    let children = repeatContainer.children(),
                      i = 0,
                      gotSomething = false,
                      insideStartEndSequence = false;

                    while (i < children.length) {
                      if (children[i].attributes[originalNgRepeatAttr] != null || insideStartEndSequence) {
                        if (!gotSomething) {
                          $scope.elementSize = 0;
                        }

                        gotSomething = true;
                        if (children[i][offsetSize]) {
                          $scope.elementSize += children[i][offsetSize];
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
                      reinitialize();
                      autoSize = false;
                      if ($scope.$root && !$scope.$root.$$phase) {
                        $scope.$apply();
                      }
                    }
                  } else {
                    var dereg = $scope.$watch(function() {
                      if (repeatContainer[0].offsetHeight || repeatContainer[0].offsetWidth) {
                        dereg();
                        setAutoSize();
                      }
                    });
                  }
                });
              }
            }

            function getLayoutProp() {
              const layoutPropPrefix = childTagName === 'tr' ? '' : 'min-';
              const layoutProp = $$horizontal ? layoutPropPrefix + 'width' : layoutPropPrefix + 'height';
              return layoutProp;
            }

            childClone.eq(0).attr(originalNgRepeatAttr, lhs + ' in ' + collectionName + (rhsSuffix ? ' ' + rhsSuffix : ''));
            childClone.addClass('vs-repeat-repeated-element');

            repeatContainer.append($beforeContent);
            repeatContainer.append(childClone);
            $compile(childClone)($scope);
            repeatContainer.append($afterContent);

            $scope.startIndex = 0;
            $scope.endIndex = 0;

            function scrollHandler() {
              if (updateInnerCollection()) {
                $scope.$digest();

                const expectedSize = sizesPropertyExists ?
                  $scope.sizesCumulative[originalLength] :
                  $scope.elementSize * originalLength;

                if (expectedSize !== repeatContainer[0][scrollSize]) {
                  console.warn('vsRepeat: size mismatch. Expected size ' + expectedSize + 'px whereas actual size is ' + repeatContainer[0][scrollSize] + 'px. Fix vsSize on element:', $element[0]);
                }
              }
            }

            $scrollParent.on('scroll', scrollHandler);

            function onWindowResize() {
              if (typeof $attrs.vsAutoresize !== 'undefined') {
                autoSize = true;
                setAutoSize();
                if ($scope.$root && !$scope.$root.$$phase) {
                  $scope.$apply();
                }
              }
              if (updateInnerCollection()) {
                $scope.$apply();
              }
            }

            angular.element(window).on('resize', onWindowResize);
            $scope.$on('$destroy', function() {
              angular.element(window).off('resize', onWindowResize);
              $scrollParent.off('scroll', scrollHandler);
            });

            $scope.$on('vsRepeatTrigger', refresh);

            $scope.$on('vsRepeatResize', function() {
              autoSize = true;
              setAutoSize();
            });

            let _prevStartIndex,
              _prevEndIndex,
              _minStartIndex,
              _maxEndIndex;

            $scope.$on('vsRenderAll', function() {//e , quantum) {
              if ($$options.latch) {
                setTimeout(function() {
                  // var __endIndex = Math.min($scope.endIndex + (quantum || 1), originalLength);
                  const __endIndex = originalLength;
                  _maxEndIndex = Math.max(__endIndex, _maxEndIndex);
                  $scope.endIndex = $$options.latch ? _maxEndIndex : __endIndex;
                  $scope[collectionName] = originalCollection.slice($scope.startIndex, $scope.endIndex);
                  _prevEndIndex = $scope.endIndex;

                  $scope.$$postDigest(function() {
                    $beforeContent.css(getLayoutProp(), 0);
                    $afterContent.css(getLayoutProp(), 0);
                  });

                  $scope.$apply(function() {
                    $scope.$emit('vsRenderAllDone');
                  });
                });
              }
            });

            function reinitialize() {
              _prevStartIndex = void 0;
              _prevEndIndex = void 0;
              _minStartIndex = originalLength;
              _maxEndIndex = 0;
              updateTotalSize(sizesPropertyExists ?
                $scope.sizesCumulative[originalLength] :
                $scope.elementSize * originalLength
              );
              updateInnerCollection();

              $scope.$emit('vsRepeatReinitialized', $scope.startIndex, $scope.endIndex);
            }

            function updateTotalSize(size) {
              $scope.totalSize = $scope.offsetBefore + size + $scope.offsetAfter;
            }

            let _prevClientSize;
            function reinitOnClientHeightChange() {
              const ch = getClientSize($scrollParent[0], clientSize);
              if (ch !== _prevClientSize) {
                reinitialize();
                if ($scope.$root && !$scope.$root.$$phase) {
                  $scope.$apply();
                }
              }
              _prevClientSize = ch;
            }

            $scope.$watch(function() {
              if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(reinitOnClientHeightChange);
              } else {
                reinitOnClientHeightChange();
              }
            });

            function updateInnerCollection() {
              const $scrollPosition = getScrollPos($scrollParent[0], scrollPos);
              let $clientSize = getClientSize($scrollParent[0], clientSize);

              if ($attrs.vsDebug === 'true') {
                $clientSize /= 2;
              }

              const scrollOffset = repeatContainer[0] === $scrollParent[0] ? 0 : getScrollOffset(
                repeatContainer[0],
                $scrollParent[0],
                $$horizontal
              );

              let __startIndex = $scope.startIndex;
              let __endIndex = $scope.endIndex;

              if (sizesPropertyExists) {
                __startIndex = 0;
                while ($scope.sizesCumulative[__startIndex] < $scrollPosition - $scope.offsetBefore - scrollOffset - $scope.scrollMargin) {
                  __startIndex++;
                }
                if (__startIndex > 0) {
                  __startIndex--;
                }

                // Adjust the start index according to the excess
                __startIndex = Math.max(
                  Math.floor(__startIndex - $scope.excess / 2),
                  0
                );

                __endIndex = __startIndex;
                while ($scope.sizesCumulative[__endIndex] < $scrollPosition - $scope.offsetBefore - scrollOffset + $scope.scrollMargin + $clientSize) {
                  __endIndex++;
                }

                // Adjust the end index according to the excess
                __endIndex = Math.min(
                  Math.ceil(__endIndex + $scope.excess / 2),
                  originalLength
                );
              } else {
                __startIndex = Math.max(
                  Math.floor(
                    ($scrollPosition - $scope.offsetBefore - scrollOffset - $scope.scrollMargin) / $scope.elementSize
                  ) - $scope.excess / 2,
                  0
                );

                __endIndex = Math.min(
                  __startIndex + Math.ceil(
                    $clientSize / $scope.elementSize
                  ) + $scope.excess,
                  originalLength
                );

                // autosizing needs at least one element to measure it
                if (autoSize && __startIndex === __endIndex && __endIndex < originalLength - 1) {
                  __endIndex++;
                }
              }

              _minStartIndex = Math.min(__startIndex, _minStartIndex);
              _maxEndIndex = Math.max(__endIndex, _maxEndIndex);

              $scope.startIndex = $$options.latch ? _minStartIndex : __startIndex;
              $scope.endIndex = $$options.latch ? _maxEndIndex : __endIndex;

              // Move to the end of the collection if we are now past it
              if (_maxEndIndex < $scope.startIndex)
                $scope.startIndex = _maxEndIndex;

              let digestRequired = false;
              if (_prevStartIndex == null) {
                digestRequired = true;
              } else if (_prevEndIndex == null) {
                digestRequired = true;
              }

              if (!digestRequired) {
                if ($$options.hunked) {
                  if (Math.abs($scope.startIndex - _prevStartIndex) >= $scope.excess / 2 ||
                                        ($scope.startIndex === 0 && _prevStartIndex !== 0)) {
                    digestRequired = true;
                  } else if (Math.abs($scope.endIndex - _prevEndIndex) >= $scope.excess / 2 ||
                                        ($scope.endIndex === originalLength && _prevEndIndex !== originalLength)) {
                    digestRequired = true;
                  }
                } else {
                  digestRequired = $scope.startIndex !== _prevStartIndex ||
                                                        $scope.endIndex !== _prevEndIndex;
                }
              }

              if (digestRequired) {
                $scope[collectionName] = originalCollection.slice($scope.startIndex, $scope.endIndex);

                // Emit the event
                $scope.$emit('vsRepeatInnerCollectionUpdated', $scope.startIndex, $scope.endIndex, _prevStartIndex, _prevEndIndex);
                let triggerIndex;
                if ($attrs.vsScrolledToEnd) {
                  triggerIndex = originalCollection.length - ($scope.scrolledToEndOffset || 0);
                  if (($scope.endIndex >= triggerIndex && _prevEndIndex < triggerIndex) || (originalCollection.length && $scope.endIndex === originalCollection.length)) {
                    $scope.$eval($attrs.vsScrolledToEnd);
                  }
                }
                if ($attrs.vsScrolledToBeginning) {
                  triggerIndex = $scope.scrolledToBeginningOffset || 0;
                  if (($scope.startIndex <= triggerIndex && _prevStartIndex > $scope.startIndex)) {
                    $scope.$eval($attrs.vsScrolledToBeginning);
                  }
                }

                _prevStartIndex = $scope.startIndex;
                _prevEndIndex = $scope.endIndex;

                const offsetCalculationString = sizesPropertyExists ?
                  '(sizesCumulative[$index + startIndex] + offsetBefore)' :
                  '(($index + startIndex) * elementSize + offsetBefore)';

                const parsed = $parse(offsetCalculationString);
                const o1 = parsed($scope, {$index: 0});
                const o2 = parsed($scope, {$index: $scope[collectionName].length});
                const total = $scope.totalSize;

                $beforeContent.css(getLayoutProp(), o1 + 'px');
                $afterContent.css(getLayoutProp(), (total - o2) + 'px');
              }

              return digestRequired;
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
    </style>`
  );

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = vsRepeatModule.name;
  }
})(window, window.angular);
