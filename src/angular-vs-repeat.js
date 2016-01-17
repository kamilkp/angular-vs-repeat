//
// Copyright Kamil Pękala http://github.com/kamilkp
// Angular Virtual Scroll Repeat v1.1.4 2016/01/17
//

(function(window, angular) {
    'use strict';
    /* jshint eqnull:true */
    /* jshint -W038 */

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

    // EVENTS:
    // - 'vsRepeatTrigger' - an event the directive listens for to manually trigger reinitialization
    // - 'vsRepeatReinitialized' - an event the directive emits upon reinitialization done

    var dde = document.documentElement,
        matchingFunction = dde.matches ? 'matches' :
                            dde.matchesSelector ? 'matchesSelector' :
                            dde.webkitMatches ? 'webkitMatches' :
                            dde.webkitMatchesSelector ? 'webkitMatchesSelector' :
                            dde.msMatches ? 'msMatches' :
                            dde.msMatchesSelector ? 'msMatchesSelector' :
                            dde.mozMatches ? 'mozMatches' :
                            dde.mozMatchesSelector ? 'mozMatchesSelector' : null;

    var closestElement = angular.element.prototype.closest || function (selector) {
        var el = this[0].parentNode;
        while (el !== document.documentElement && el != null && !el[matchingFunction](selector)) {
            el = el.parentNode;
        }

        if (el && el[matchingFunction](selector)) {
            return angular.element(el);
        }
        else {
            return angular.element();
        }
    };

    function getWindowScroll() {
        if ('pageYOffset' in window) {
            return {
                scrollTop: pageYOffset,
                scrollLeft: pageXOffset
            };
        }
        else {
            var sx, sy, d = document, r = d.documentElement, b = d.body;
            sx = r.scrollLeft || b.scrollLeft || 0;
            sy = r.scrollTop || b.scrollTop || 0;
            return {
                scrollTop: sy,
                scrollLeft: sx
            };
        }
    }

    function getClientSize(element, sizeProp) {
        if (element === window) {
            return sizeProp === 'clientWidth' ? window.innerWidth : window.innerHeight;
        }
        else {
            return element[sizeProp];
        }
    }

    function getScrollPos(element, scrollProp) {
        return element === window ? getWindowScroll()[scrollProp] : element[scrollProp];
    }

    function getScrollOffset(vsElement, scrollElement, isHorizontal) {
        var vsPos = vsElement.getBoundingClientRect()[isHorizontal ? 'left' : 'top'];
        var scrollPos = scrollElement === window ? 0 : scrollElement.getBoundingClientRect()[isHorizontal ? 'left' : 'top'];
        var correction = vsPos - scrollPos +
            (scrollElement === window ? getWindowScroll() : scrollElement)[isHorizontal ? 'scrollLeft' : 'scrollTop'];

        return correction;
    }

    var vsRepeatModule = angular.module('vs-repeat', []).directive('vsRepeat', ['$compile', '$parse', function($compile, $parse) {
        return {
            restrict: 'A',
            scope: true,
            compile: function($element) {
                var ngRepeatChild = $element.children().eq(0),
                    ngRepeatExpression,
                    childCloneHtml = ngRepeatChild[0].outerHTML,
                    expressionMatches,
                    lhs,
                    rhs,
                    rhsSuffix,
                    originalNgRepeatAttr,
                    collectionName = '$vs_collection',
                    isNgRepeatStart = false,
                    attributesDictionary = {
                        'vsRepeat': 'elementSize',
                        'vsOffsetBefore': 'offsetBefore',
                        'vsOffsetAfter': 'offsetAfter',
                        'vsExcess': 'excess'
                    };

                if (ngRepeatChild.attr('ng-repeat')) {
                    originalNgRepeatAttr = 'ng-repeat';
                    ngRepeatExpression = ngRepeatChild.attr('ng-repeat');
                }
                else if (ngRepeatChild.attr('data-ng-repeat')) {
                    originalNgRepeatAttr = 'data-ng-repeat';
                    ngRepeatExpression = ngRepeatChild.attr('data-ng-repeat');
                }
                else if (ngRepeatChild.attr('ng-repeat-start')) {
                    isNgRepeatStart = true;
                    originalNgRepeatAttr = 'ng-repeat-start';
                    ngRepeatExpression = ngRepeatChild.attr('ng-repeat-start');
                }
                else if (ngRepeatChild.attr('data-ng-repeat-start')) {
                    isNgRepeatStart = true;
                    originalNgRepeatAttr = 'data-ng-repeat-start';
                    ngRepeatExpression = ngRepeatChild.attr('data-ng-repeat-start');
                }
                else {
                    throw new Error('angular-vs-repeat: no ng-repeat directive on a child element');
                }

                expressionMatches = /^\s*(\S+)\s+in\s+([\S\s]+?)(track\s+by\s+\S+)?$/.exec(ngRepeatExpression);
                lhs = expressionMatches[1];
                rhs = expressionMatches[2];
                rhsSuffix = expressionMatches[3];

                if (isNgRepeatStart) {
                    var index = 0;
                    var repeaterElement = $element.children().eq(0);
                    while(repeaterElement.attr('ng-repeat-end') == null && repeaterElement.attr('data-ng-repeat-end') == null) {
                        index++;
                        repeaterElement = $element.children().eq(index);
                        childCloneHtml += repeaterElement[0].outerHTML;
                    }
                }

                $element.empty();
                return {
                    pre: function($scope, $element, $attrs) {
                        var childClone = angular.element(childCloneHtml),
                            childTagName = childClone[0].tagName.toLowerCase(),
                            originalCollection = [],
                            originalLength,
                            $$horizontal = typeof $attrs.vsHorizontal !== 'undefined',
                            $beforeContent = angular.element('<' + childTagName + ' class="vs-repeat-before-content"></' + childTagName + '>'),
                            $afterContent = angular.element('<' + childTagName + ' class="vs-repeat-after-content"></' + childTagName + '>'),
                            autoSize = !$attrs.vsRepeat,
                            sizesPropertyExists = !!$attrs.vsSize || !!$attrs.vsSizeProperty,
                            $scrollParent = $attrs.vsScrollParent ?
                                $attrs.vsScrollParent === 'window' ? angular.element(window) :
                                closestElement.call($element, $attrs.vsScrollParent) : $element,
                            $$options = 'vsOptions' in $attrs ? $scope.$eval($attrs.vsOptions) : {},
                            clientSize = $$horizontal ? 'clientWidth' : 'clientHeight',
                            offsetSize = $$horizontal ? 'offsetWidth' : 'offsetHeight',
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

                        //initial defaults
                        $scope.elementSize = (+$attrs.vsRepeat) || getClientSize($scrollParent[0], clientSize) || 50;
                        $scope.offsetBefore = 0;
                        $scope.offsetAfter = 0;
                        $scope.excess = 2;

                        if ($$horizontal) {
                            $beforeContent.css('height', '100%');
                            $afterContent.css('height', '100%');
                        }
                        else {
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
                                updateTotalSize(0);
                                $scope.sizesCumulative = [0];
                                return;
                            }
                            else {
                                originalLength = originalCollection.length;
                                if (sizesPropertyExists) {
                                    $scope.sizes = originalCollection.map(function(item) {
                                        var s = $scope.$new(false);
                                        angular.extend(s, item);
                                        s[lhs] = item;
                                        var size = ($attrs.vsSize || $attrs.vsSizeProperty) ?
                                                        s.$eval($attrs.vsSize || $attrs.vsSizeProperty) :
                                                        $scope.elementSize;
                                        s.$destroy();
                                        return size;
                                    });
                                    var sum = 0;
                                    $scope.sizesCumulative = $scope.sizes.map(function(size) {
                                        var res = sum;
                                        sum += size;
                                        return res;
                                    });
                                    $scope.sizesCumulative.push(sum);
                                }
                                else {
                                    setAutoSize();
                                }
                            }

                            reinitialize();
                        }

                        function setAutoSize() {
                            if (autoSize) {
                                $scope.$$postDigest(function() {
                                    if ($element[0].offsetHeight || $element[0].offsetWidth) { // element is visible
                                        var children = $element.children(),
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
                                                    }
                                                    else {
                                                        insideStartEndSequence = true;
                                                    }
                                                }
                                                else {
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
                                    }
                                    else {
                                        var dereg = $scope.$watch(function() {
                                            if ($element[0].offsetHeight || $element[0].offsetWidth) {
                                                dereg();
                                                setAutoSize();
                                            }
                                        });
                                    }
                                });
                            }
                        }

                        childClone.eq(0).attr(originalNgRepeatAttr, lhs + ' in ' + collectionName + (rhsSuffix ? ' ' + rhsSuffix : ''));
                        childClone.addClass('vs-repeat-repeated-element');

                        $element.append($beforeContent);
                        $element.append(childClone);
                        $compile(childClone)($scope);
                        $element.append($afterContent);

                        $scope.startIndex = 0;
                        $scope.endIndex = 0;

                        $scrollParent.on('scroll', function scrollHandler() {
                            if (updateInnerCollection()) {
                                $scope.$digest();
                            }
                        });

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
                        });

                        $scope.$on('vsRepeatTrigger', refresh);

                        $scope.$on('vsRepeatResize', function() {
                            autoSize = true;
                            setAutoSize();
                        });

                        var _prevStartIndex,
                            _prevEndIndex,
                            _minStartIndex,
                            _maxEndIndex;

                        $scope.$on('vsRenderAll', function() {//e , quantum) {
                            if($$options.latch) {
                                setTimeout(function() {
                                    // var __endIndex = Math.min($scope.endIndex + (quantum || 1), originalLength);
                                    var __endIndex = originalLength;
                                    _maxEndIndex = Math.max(__endIndex, _maxEndIndex);
                                    $scope.endIndex = $$options.latch ? _maxEndIndex : __endIndex;
                                    $scope[collectionName] = originalCollection.slice($scope.startIndex, $scope.endIndex);
                                    _prevEndIndex = $scope.endIndex;

                                    $scope.$$postDigest(function() {
                                        var layoutProp = $$horizontal ? 'width' : 'height';
                                        $beforeContent.css(layoutProp, 0);
                                        $afterContent.css(layoutProp, 0);
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

                        var _prevClientSize;
                        function reinitOnClientHeightChange() {
                            var ch = getClientSize($scrollParent[0], clientSize);
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
                            }
                            else {
                                reinitOnClientHeightChange();
                            }
                        });

                        function updateInnerCollection() {
                            var $scrollPosition = getScrollPos($scrollParent[0], scrollPos);
                            var $clientSize = getClientSize($scrollParent[0], clientSize);

                            var scrollOffset = $element[0] === $scrollParent[0] ? 0 : getScrollOffset(
                                                    $element[0],
                                                    $scrollParent[0],
                                                    $$horizontal
                                                );

                            var __startIndex = $scope.startIndex;
                            var __endIndex = $scope.endIndex;

                            if (sizesPropertyExists) {
                                __startIndex = 0;
                                while ($scope.sizesCumulative[__startIndex] < $scrollPosition - $scope.offsetBefore - scrollOffset) {
                                    __startIndex++;
                                }
                                if (__startIndex > 0) { __startIndex--; }

                                // Adjust the start index according to the excess
                                __startIndex = Math.max(
                                    Math.floor(__startIndex - $scope.excess / 2),
                                    0
                                );

                                __endIndex = __startIndex;
                                while ($scope.sizesCumulative[__endIndex] < $scrollPosition - $scope.offsetBefore - scrollOffset + $clientSize) {
                                    __endIndex++;
                                }

                                // Adjust the end index according to the excess
                                __endIndex = Math.min(
                                    Math.ceil(__endIndex + $scope.excess / 2),
                                    originalLength
                                );
                            }
                            else {
                                __startIndex = Math.max(
                                    Math.floor(
                                        ($scrollPosition - $scope.offsetBefore - scrollOffset) / $scope.elementSize
                                    ) - $scope.excess / 2,
                                    0
                                );

                                __endIndex = Math.min(
                                    __startIndex + Math.ceil(
                                        $clientSize / $scope.elementSize
                                    ) + $scope.excess,
                                    originalLength
                                );
                            }

                            _minStartIndex = Math.min(__startIndex, _minStartIndex);
                            _maxEndIndex = Math.max(__endIndex, _maxEndIndex);

                            $scope.startIndex = $$options.latch ? _minStartIndex : __startIndex;
                            $scope.endIndex = $$options.latch ? _maxEndIndex : __endIndex;

                            var digestRequired = false;
                            if (_prevStartIndex == null) {
                                digestRequired = true;
                            }
                            else if (_prevEndIndex == null) {
                                digestRequired = true;
                            }

                            if (!digestRequired) {
                                if ($$options.hunked) {
                                    if (Math.abs($scope.startIndex - _prevStartIndex) >= $scope.excess / 2 ||
                                        ($scope.startIndex === 0 && _prevStartIndex !== 0)) {
                                        digestRequired = true;
                                    }
                                    else if (Math.abs($scope.endIndex - _prevEndIndex) >= $scope.excess / 2 ||
                                        ($scope.endIndex === originalLength && _prevEndIndex !== originalLength)) {
                                        digestRequired = true;
                                    }
                                }
                                else {
                                    digestRequired = $scope.startIndex !== _prevStartIndex ||
                                                        $scope.endIndex !== _prevEndIndex;
                                }
                            }

                            if (digestRequired) {
                                $scope[collectionName] = originalCollection.slice($scope.startIndex, $scope.endIndex);

                                // Emit the event
                                $scope.$emit('vsRepeatInnerCollectionUpdated', $scope.startIndex, $scope.endIndex, _prevStartIndex, _prevEndIndex);
                                _prevStartIndex = $scope.startIndex;
                                _prevEndIndex = $scope.endIndex;

                                var offsetCalculationString = sizesPropertyExists ?
                                    '(sizesCumulative[$index + startIndex] + offsetBefore)' :
                                    '(($index + startIndex) * elementSize + offsetBefore)';

                                var parsed = $parse(offsetCalculationString);
                                var o1 = parsed($scope, {$index: 0});
                                var o2 = parsed($scope, {$index: $scope[collectionName].length});
                                var total = $scope.totalSize;
                                var layoutProp = $$horizontal ? 'width' : 'height';

                                $beforeContent.css(layoutProp, o1 + 'px');
                                $afterContent.css(layoutProp, (total - o2) + 'px');
                            }

                            return digestRequired;
                        }
                    }
                };
            }
        };
    }]);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = vsRepeatModule.name;
    }
})(window, window.angular);
