//
// Copyright Kamil Pękala http://github.com/kamilkp
// Angular Virtual Scroll Repeat v1.0.0-rc13 2015/08/30
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
    // vs-size-property - a property name of the items in collection that is a number denoting the element size (in pixels)
    // vs-autoresize - use this attribute without vs-size-property and without specifying element's size. The automatically computed element style will
    //              readjust upon window resize if the size is dependable on the viewport size

    // EVENTS:
    // - 'vsRepeatTrigger' - an event the directive listens for to manually trigger reinitialization
    // - 'vsRepeatReinitialized' - an event the directive emits upon reinitialization done

    var isMacOS = navigator.appVersion.indexOf('Mac') != -1,
        wheelEventName = typeof window.onwheel !== 'undefined' ? 'wheel' : typeof window.onmousewheel !== 'undefined' ? 'mousewheel' : 'DOMMouseScroll',
        dde = document.documentElement,
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

    var vsRepeatModule = angular.module('vs-repeat', []).directive('vsRepeat', ['$compile', function($compile) {
        return {
            restrict: 'A',
            scope: true,
            require: '?^vsRepeat',
            controller: ['$scope', function($scope) {
                this.$scrollParent = $scope.$scrollParent;
                this.$fillElement = $scope.$fillElement;
            }],
            compile: function($element) {
                var ngRepeatChild = $element.children().eq(0),
                    ngRepeatExpression = ngRepeatChild.attr('ng-repeat') || ngRepeatChild.attr('data-ng-repeat'),
                    childCloneHtml = ngRepeatChild[0].outerHTML,
                    expressionMatches = /^\s*(\S+)\s+in\s+([\S\s]+?)(track\s+by\s+\S+)?$/.exec(ngRepeatExpression),
                    lhs = expressionMatches[1],
                    rhs = expressionMatches[2],
                    rhsSuffix = expressionMatches[3],
                    collectionName = '$vs_collection',
                    attributesDictionary = {
                        'vsRepeat': 'elementSize',
                        'vsOffsetBefore': 'offsetBefore',
                        'vsOffsetAfter': 'offsetAfter',
                        'vsExcess': 'excess'
                    };

                $element.empty();
                if (!window.getComputedStyle || window.getComputedStyle($element[0]).position !== 'absolute') {
                    $element.css('position', 'relative');
                }
                return {
                    pre: function($scope, $element, $attrs, $ctrl) {
                        var childClone = angular.element(childCloneHtml),
                            originalCollection = [],
                            originalLength,
                            $$horizontal = typeof $attrs.vsHorizontal !== 'undefined',
                            $wheelHelper,
                            $fillElement,
                            autoSize = !$attrs.vsRepeat,
                            sizesPropertyExists = !!$attrs.vsSize || !!$attrs.vsSizeProperty,
                            $scrollParent = $attrs.vsScrollParent ?
                                $attrs.vsScrollParent === 'window' ? angular.element(window) :
                                closestElement.call($element, $attrs.vsScrollParent) : $element,
                            positioningProperty = $$horizontal ? 'left' : 'top',
                            localScrollTrigger = false,
                            $$options = 'vsOptions' in $attrs ? $scope.$eval($attrs.vsOptions) : {},
                            clientSize = $$horizontal ? 'clientWidth' : 'clientHeight',
                            offsetSize = $$horizontal ? 'offsetWidth' : 'offsetHeight',
                            scrollPos = $$horizontal ? 'scrollLeft' : 'scrollTop';

                        if (!('vsSize' in $attrs) && 'vsSizeProperty' in $attrs) {
                            console.warn('vs-size-property attribute is deprecated. Please use vs-size attrubute which also accepts angular expressions.');
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
                        $scope.scrollSettings = {
                            scrollIndex: 0,
                            scrollIndexPosition: 'top'
                        };

                        $scope.$watch($attrs.vsScrollSettings, function(newValue) {
                            if (typeof newValue === 'undefined') {
                                return;
                            }
                            $scope.scrollSettings = newValue;
                            reinitialize($scope.scrollSettings);
                        }, true);

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

                        function refresh(event, data) {
                            if (!originalCollection || originalCollection.length < 1) {
                                $scope[collectionName] = [];
                                originalLength = 0;
                                resizeFillElement(0);
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

                            reinitialize(data);
                        }

                        function setAutoSize() {
                            if (autoSize) {
                                $scope.$$postDigest(function() {
                                    if ($element[0].offsetHeight || $element[0].offsetWidth) { // element is visible
                                        var children = $element.children(),
                                            i = 0;
                                        while (i < children.length) {
                                            if (children[i].attributes['ng-repeat'] != null || children[i].attributes['data-ng-repeat'] != null) {
                                                if (children[i][offsetSize]) {
                                                    $scope.elementSize = children[i][offsetSize];
                                                    reinitialize();
                                                    autoSize = false;
                                                    if ($scope.$root && !$scope.$root.$$phase) {
                                                        $scope.$apply();
                                                    }
                                                }
                                                break;
                                            }
                                            i++;
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

                        childClone.attr('ng-repeat', lhs + ' in ' + collectionName + (rhsSuffix ? ' ' + rhsSuffix : ''))
                                .addClass('vs-repeat-repeated-element');

                        var offsetCalculationString = sizesPropertyExists ?
                            '(sizesCumulative[$index + startIndex] + offsetBefore)' :
                            '(($index + startIndex) * elementSize + offsetBefore)';


                        childClone.attr('vs-set-offset', offsetCalculationString);
                        childClone.attr('vs-set-offset-positioning-property', positioningProperty);

                        $compile(childClone)($scope);
                        $element.append(childClone);

                        $fillElement = angular.element('<div class="vs-repeat-fill-element"></div>')
                            .css({
                                'position': 'relative',
                                'min-height': '100%',
                                'min-width': '100%'
                            });
                        $element.append($fillElement);
                        $compile($fillElement)($scope);
                        $scope.$fillElement = $fillElement;

                        var _prevMouse = {};
                        if (isMacOS && $attrs.vsScrollParent !== 'window') {
                            $wheelHelper = angular.element('<div class="vs-repeat-wheel-helper"></div>')
                                .on(wheelEventName, function(e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (e.originalEvent) {
                                        e = e.originalEvent;
                                    }
                                    $scrollParent[0].scrollLeft += (e.deltaX || -e.wheelDeltaX);
                                    $scrollParent[0].scrollTop += (e.deltaY || -e.wheelDeltaY);
                                }).on('mousemove', function(e) {
                                    if (_prevMouse.x !== e.clientX || _prevMouse.y !== e.clientY) {
                                        angular.element(this).css('display', 'none');
                                    }
                                    _prevMouse = {
                                        x: e.clientX,
                                        y: e.clientY
                                    };
                                }).css('display', 'none');
                            $fillElement.append($wheelHelper);
                        }

                        $scope.startIndex = 0;
                        $scope.endIndex = 0;

                        $scrollParent.on('scroll', function scrollHandler() {
                            // Check if the scrolling was triggerred by a local action to avoid
                            // unnecessary inner collection updating

                            if (localScrollTrigger) {
                                localScrollTrigger = false;
                            }
                            else {
                                if (updateInnerCollection()) {
                                    $scope.$apply();
                                    $scope.$broadcast('vsSetOffset-refresh');
                                }
                            }
                        });

                        if (isMacOS) {
                            $scrollParent.on(wheelEventName, wheelHandler);
                        }
                        function wheelHandler(e) {
                            var elem = e.currentTarget;
                            if (elem.scrollWidth > elem.clientWidth || elem.scrollHeight > elem.clientHeight) {
                                $wheelHelper.css('display', 'block');
                            }
                        }

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
                                $scope.$broadcast('vsSetOffset-refresh');
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

                                    $scope.$apply(function() {
                                        $scope.$emit('vsRenderAllDone');
                                    });
                                });
                            }
                        });

                        function reinitialize(data) {
                            _prevStartIndex = void 0;
                            _prevEndIndex = void 0;
                            _minStartIndex = originalLength;
                            _maxEndIndex = 0;
                            updateInnerCollection(data);
                            resizeFillElement(sizesPropertyExists ?
                                                $scope.sizesCumulative[originalLength] :
                                                $scope.elementSize * originalLength
                                            );

                            // Allow Angular to update ng-repeat $index values before syncing offsets:
                            $scope.$evalAsync(function(){
                                $scope.$broadcast('vsSetOffset-refresh');
                            });
                            $scope.$emit('vsRepeatReinitialized', $scope.startIndex, $scope.endIndex);
                        }

                        function resizeFillElement(size) {
                            if ($$horizontal) {
                                $fillElement.css({
                                    'width': $scope.offsetBefore + size + $scope.offsetAfter + 'px',
                                    'height': '100%'
                                });
                                if ($ctrl && $ctrl.$fillElement) {
                                    var referenceElement = $ctrl.$fillElement[0].parentNode.querySelector('[ng-repeat]');
                                    if (referenceElement) {
                                        $ctrl.$fillElement.css({
                                            'width': referenceElement.scrollWidth + 'px'
                                        });
                                    }
                                }
                            }
                            else {
                                $fillElement.css({
                                    'height': $scope.offsetBefore + size + $scope.offsetAfter + 'px',
                                    'width': '100%'
                                });
                                if ($ctrl && $ctrl.$fillElement) {
                                    referenceElement = $ctrl.$fillElement[0].parentNode.querySelector('[ng-repeat]');
                                    if (referenceElement) {
                                        $ctrl.$fillElement.css({
                                            'height': referenceElement.scrollHeight + 'px'
                                        });
                                    }
                                }
                            }
                        }

                        var _prevClientSize;
                        function reinitOnClientHeightChange() {
                            var ch = getClientSize($scrollParent[0], clientSize);
                            if (ch !== _prevClientSize) {
                                reinitialize();
                                if ($scope.$root && !$scope.$root.$$phase) {
                                    $scope.$apply();
                                    $scope.$broadcast('vsSetOffset-refresh');
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

                        // Scroll to required position
                        // scrollTo - number of pixels to be scrolled to
                        function scrollToPosition(scrollTo) {
                            var scrolled = false;
                            if (scrollTo !== undefined && (typeof scrollTo) === 'number') {
                                // Set the position to be scrolled to
                                scrolled = Math.max(scrollTo, 0);

                                // Is there a scroll change?
                                if ($scrollParent[0][scrollPos] !== scrolled) {
                                    $scrollParent[0][scrollPos] = scrolled;
                                    localScrollTrigger = true;
                                }
                                else {
                                    scrolled = false;
                                }

                                // Emit the event
                                $scope.$emit('vsRepeatScrolled', scrolled);
                            }
                            return scrolled;
                        }

                        function updateInnerCollection(data) {
                            var $scrollPosition = getScrollPos($scrollParent[0], scrollPos);
                            var $clientSize = getClientSize($scrollParent[0], clientSize);

                            var scrollOffset = $element[0] === $scrollParent[0] ? 0 : getScrollOffset(
                                                    $element[0],
                                                    $scrollParent[0],
                                                    $$horizontal
                                                );

                            var scrollChange = true,
                                position,
                                visibleStartIndex,
                                scrollIndexCumulativeSize,
                                scrollIndexSize;

                            var __startIndex = $scope.startIndex;
                            var __endIndex = $scope.endIndex;

                            if (data && data.elementSize !== undefined) {
                                $scope.elementSize = data.elementSize;
                            }

                            if (data && data.scrollIndex !== undefined) {
                                if (typeof $scope.scrollSettings !== 'undefined') {
                                    $scope.scrollSettings.scrollIndex = data.scrollIndex;
                                }

                                if (sizesPropertyExists) {
                                    scrollIndexSize = $scope.sizes[data.scrollIndex];
                                    scrollIndexCumulativeSize = $scope.sizesCumulative[data.scrollIndex];
                                }
                                else {
                                    scrollIndexSize = $scope.elementSize;
                                    scrollIndexCumulativeSize = data.scrollIndex * $scope.elementSize;
                                }

                                // Item scroll position relative to the view, i.e. position === 0 means the top of the view,
                                // position === $clientSize means the bottom
                                if (data.scrollIndexPosition !== undefined) {
                                    if (typeof $scope.scrollSettings !== 'undefined') {
                                        $scope.scrollSettings.scrollIndexPosition = data.scrollIndexPosition;
                                    }
                                    position = 0;
                                    switch (typeof data.scrollIndexPosition) {
                                        case 'number':
                                            position = data.scrollIndexPosition + $scope.offsetBefore;
                                            break;
                                        case 'string':
                                            switch (data.scrollIndexPosition) {
                                                case 'top':
                                                    position = $scope.offsetBefore;
                                                    break;
                                                case 'middle':
                                                    position = ($clientSize - scrollIndexSize) / 2;
                                                    break;
                                                case 'bottom':
                                                    position = $clientSize - scrollIndexSize - $scope.offsetAfter;
                                                    break;
                                                case 'inview':
                                                case 'inview#top':
                                                case 'inview#middle':
                                                case 'inview#bottom':
                                                case 'inview#auto':
                                                        // The item is in the viewport, do nothing
                                                    if (
                                                            ($scrollParent[0][scrollPos] <= (scrollIndexCumulativeSize)) &&
                                                            ($scrollParent[0][scrollPos] + $clientSize - scrollIndexSize >= scrollIndexCumulativeSize)) {
                                                        scrollChange = false;
                                                        // The current item scroll position
                                                        position = scrollIndexCumulativeSize - $scrollParent[0][scrollPos];
                                                    }
                                                    // The item is out of the viewport
                                                    else {
                                                        if (data.scrollIndexPosition === 'inview#top' || data.scrollIndexPosition === 'inview') {
                                                            // Get it at the top
                                                            position = $scope.offsetBefore;
                                                        }
                                                        if (data.scrollIndexPosition === 'inview#bottom') {
                                                            // Get it at the bottom
                                                            position = $clientSize - scrollIndexSize + $scope.offsetAfter;
                                                        }
                                                        if (data.scrollIndexPosition === 'inview#middle') {
                                                            // Get it at the middle
                                                            position = ($clientSize - scrollIndexSize) / 2;
                                                        }
                                                        if (data.scrollIndexPosition === 'inview#auto') {
                                                            // Get it at the bottom or at the top, depending on what is closer
                                                            if ($scrollParent[0][scrollPos] <= scrollIndexCumulativeSize) {
                                                                position = $clientSize - scrollIndexSize + $scope.offsetAfter;
                                                            }
                                                            else {
                                                                position = $scope.offsetBefore;
                                                            }
                                                        }
                                                    }
                                                    break;
                                                default:
                                                    console.warn('Incorrect scrollIndexPosition string value');
                                                    break;
                                            }
                                            break;
                                        default:
                                            console.warn('Incorrect scrollIndexPosition type');
                                            break;
                                    }
                                }
                                else {
                                    // The item is not required to be in the viewport, do nothing
                                    scrollChange = false;
                                    // The current item scroll position
                                    if (sizesPropertyExists) {
                                        position = $scope.sizesCumulative[data.scrollIndex] - $scrollParent[0][scrollPos];
                                    }
                                    else {
                                        position = (data.scrollIndex * $scope.elementSize) - $scrollParent[0][scrollPos];
                                    }
                                }

                                __startIndex = data.scrollIndex;

                                if (sizesPropertyExists) {

                                    while ($scope.sizesCumulative[__startIndex] > $scope.sizesCumulative[data.scrollIndex] - position) {
                                        __startIndex--;
                                    }
                                    // The real first item in the view
                                    visibleStartIndex = Math.max(__startIndex, 0);

                                    // Adjust the start index according to the excess
                                    __startIndex = Math.max(
                                        Math.floor(__startIndex - ($scope.excess / 2)),
                                        0
                                    );

                                    __endIndex = __startIndex;
                                    while ($scope.sizesCumulative[__endIndex] < $scope.sizesCumulative[visibleStartIndex] - $scope.offsetBefore + $clientSize) {
                                        __endIndex++;
                                    }
                                    // Adjust the end index according to the excess
                                    __endIndex = Math.min(
                                        Math.ceil(__endIndex + ($scope.excess / 2)),
                                        originalLength
                                    );

                                }
                                else {

                                    while ((__startIndex * $scope.elementSize) > (data.scrollIndex * $scope.elementSize) - position) {
                                        __startIndex--;
                                    }
                                    // The real first item in the view
                                    visibleStartIndex = Math.max(__startIndex, 0);
                                    __startIndex = Math.max(
                                        Math.floor(__startIndex - ($scope.excess / 2)),
                                        0
                                    );

                                    __endIndex = Math.min(
                                        __startIndex + Math.ceil($clientSize / $scope.elementSize) + $scope.excess / 2,
                                        originalLength
                                    );

                                }
                            }
                            else {
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
                            }

                            _minStartIndex = Math.min(__startIndex, _minStartIndex);
                            _maxEndIndex = Math.max(__endIndex, _maxEndIndex);

                            $scope.startIndex = $$options.latch ? _minStartIndex : __startIndex;
                            $scope.endIndex = $$options.latch ? _maxEndIndex : __endIndex;

                            if (data !== undefined && data.scrollIndex !== undefined && position !== undefined && scrollChange) {
                                // Scroll to the requested position
                                scrollToPosition(scrollIndexCumulativeSize - position);
                            }

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
                            }

                            return digestRequired;
                        }
                    }
                };
            }
        };
    }]).directive('vsSetOffset', [function() {
        return function($scope, $element, $attrs) {
            var positioningProperty = $attrs.vsSetOffsetPositioningProperty;

            setOffset();
            $scope.$on('vsSetOffset-refresh', setOffset);

            function setOffset() {
                $element.css(positioningProperty, $scope.$eval($attrs.vsSetOffset) + 'px');
            }
        };
    }]);

    angular.element(document.head).append([
        '<style>' +
        '.vs-repeat-wheel-helper{' +
            'position: absolute;' +
            'top: 0;' +
            'bottom: 0;' +
            'left: 0;' +
            'right: 0;' +
            'z-index: 99999;' +
            'background: rgba(0, 0, 0, 0);' +
        '}' +
        '.vs-repeat-repeated-element{' +
            'position: absolute;' +
            'z-index: 1;' +
        '}' +
        '</style>'
    ].join(''));

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = vsRepeatModule.name;
    }
})(window, window.angular);
