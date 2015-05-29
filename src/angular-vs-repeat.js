//
// Copyright Kamil Pękala http://github.com/kamilkp
// Angular Virtual Scroll Repeat v1.0.0-rc8 2015/05/29
//

(function(window, angular){
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

    var closestElement = angular.element.prototype.closest || function (selector){
        var el = this[0].parentNode;
        while(el !== document.documentElement && el != null && !el[matchingFunction](selector)){
            el = el.parentNode;
        }

        if(el && el[matchingFunction](selector))
            return angular.element(el);
        else
            return angular.element();
    };

    function getWindowScroll(){
        if('pageYOffset' in window){
            return {
                scrollTop: pageYOffset,
                scrollLeft: pageXOffset
            };
        }
        else{
            var sx, sy, d = document, r = d.documentElement, b = d.body;
            sx = r.scrollLeft || b.scrollLeft || 0;
            sy = r.scrollTop || b.scrollTop || 0;
            return {
                scrollTop: sy,
                scrollLeft: sx
            };
        }
    }

    function getClientSize(element, sizeProp){
        if(element === window)
            return sizeProp === 'clientWidth' ? window.innerWidth : window.innerHeight;
        else
            return element[sizeProp];
    }

    function getScrollPos(element, scrollProp){
        return element === window ? getWindowScroll()[scrollProp] : element[scrollProp];
    }

    function getScrollOffset(vsElement, scrollElement, isHorizontal){
        var vsPos = vsElement.getBoundingClientRect()[isHorizontal ? 'left' : 'top'];
        var scrollPos = scrollElement === window ? 0 : scrollElement.getBoundingClientRect()[isHorizontal ? 'left' : 'top'];
        var correction = vsPos - scrollPos + getWindowScroll()[isHorizontal ? 'scrollLeft' : 'scrollTop'];

        return correction;
    }

    function getRenderViewPortSize(vsElement, scrollElement, isHorizontal){
        var vsPos = vsElement.getBoundingClientRect()[isHorizontal ? 'left' : 'top'];
        var containerBound = scrollElement === window ? window.innerHeight : scrollElement.getBoundingClientRect()[isHorizontal ? 'right' : 'bottom'];
        return Math.max(
                Math.min(
                    getClientSize(scrollElement, isHorizontal ? 'clientWidth' : 'clientHeight'),
                    containerBound - vsPos
                ),
            0);
    }

    angular.module('vs-repeat', []).directive('vsRepeat', ['$compile', function($compile){
        return {
            restrict: 'A',
            scope: true,
            require: '?^vsRepeat',
            controller: ['$scope', function($scope){
                this.$scrollParent = $scope.$scrollParent;
                this.$fillElement = $scope.$fillElement;
            }],
            compile: function($element, $attrs){
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
                if(!window.getComputedStyle || window.getComputedStyle($element[0]).position !== 'absolute')
                    $element.css('position', 'relative');
                return {
                    pre: function($scope, $element, $attrs, $ctrl){
                        var childClone = angular.element(childCloneHtml),
                            originalCollection = [],
                            originalLength,
                            $$horizontal = typeof $attrs.vsHorizontal !== "undefined",
                            $wheelHelper,
                            $fillElement,
                            autoSize = !$attrs.vsRepeat,
                            sizesPropertyExists = !!$attrs.vsSize || !!$attrs.vsSizeProperty,
                            $scrollParent = $attrs.vsScrollParent ?
                                $attrs.vsScrollParent === 'window' ? angular.element(window) :
                                closestElement.call($element, $attrs.vsScrollParent) : $element,
                            positioningPropertyTransform = $$horizontal ? 'translateX' : 'translateY',
                            positioningProperty = $$horizontal ? 'left' : 'top',

                            localScrollTrigger = false,

                            clientSize =  $$horizontal ? 'clientWidth' : 'clientHeight',
                            offsetSize =  $$horizontal ? 'offsetWidth' : 'offsetHeight',
                            scrollPos =  $$horizontal ? 'scrollLeft' : 'scrollTop';

                        if(!('vsSize' in $attrs) && 'vsSizeProperty' in $attrs)
                            console.warn('vs-size-property attribute is deprecated. Please use vs-size attrubute which also accepts angular expressions.');

                        if($scrollParent.length === 0) throw 'Specified scroll parent selector did not match any element';
                        $scope.$scrollParent = $scrollParent;

                        if(sizesPropertyExists) $scope.sizesCumulative = [];

                        //initial defaults
                        $scope.elementSize = (+$attrs.vsRepeat) || getClientSize($scrollParent[0], clientSize) || 50;
                        $scope.offsetBefore = 0;
                        $scope.offsetAfter = 0;
                        $scope.excess = 2;
                        $scope.scrollSettings = {
                            scrollIndex: 0,
                            scrollIndexPosition: 'top'
                        };

                        $scope.$watch($attrs.vsScrollSettings, function(newValue, oldValue) {
                            if (typeof newValue === 'undefined') {
                                return;
                            }
                            $scope.scrollSettings = newValue;
                            reinitialize($scope.scrollSettings);
                        }, true);

                        Object.keys(attributesDictionary).forEach(function(key){
                            if($attrs[key]){
                                $attrs.$observe(key, function(value){
                                    // '+' serves for getting a number from the string as the attributes are always strings
                                    $scope[attributesDictionary[key]] = +value;
                                    reinitialize();
                                });
                            }
                        });


                        $scope.$watchCollection(rhs, function(coll){
                            originalCollection = coll || [];
                            refresh();
                        });

                        function refresh(event, data){
                            if(!originalCollection || originalCollection.length < 1){
                                $scope[collectionName] = [];
                                originalLength = 0;
                                resizeFillElement(0);
                                $scope.sizesCumulative = [0];
                                return;
                            }
                            else{
                                originalLength = originalCollection.length;
                                if(sizesPropertyExists){
                                    $scope.sizes = originalCollection.map(function(item){
                                        var s = $scope.$new(true);
                                        angular.extend(s, item);
                                        var size = s.$eval($attrs.vsSize || $attrs.vsSizeProperty) || $scope.elementSize;
                                        s.$destroy();
                                        return size;
                                    });
                                    var sum = 0;
                                    $scope.sizesCumulative = $scope.sizes.map(function(size){
                                        var res = sum;
                                        sum += size;
                                        return res;
                                    });
                                    $scope.sizesCumulative.push(sum);
                                }
                                else
                                    setAutoSize();
                            }

                            reinitialize(data);
                        }

                        function setAutoSize(){
                            if(autoSize){
                                $scope.$$postDigest(function(){
                                    if($element[0].offsetHeight || $element[0].offsetWidth){ // element is visible
                                        var children = $element.children(),
                                            i = 0;
                                        while(i < children.length){
                                            if(children[i].attributes['ng-repeat'] != null || children[i].attributes['data-ng-repeat'] != null){
                                                if(children[i][offsetSize]){
                                                    $scope.elementSize = children[i][offsetSize];
                                                    reinitialize();
                                                    autoSize = false;
                                                    if($scope.$root && !$scope.$root.$$phase)
                                                        $scope.$apply();
                                                }
                                                break;
                                            }
                                            i++;
                                        }
                                    }
                                    else{
                                        var dereg = $scope.$watch(function(){
                                            if($element[0].offsetHeight || $element[0].offsetWidth){
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


                        childClone.attr('vs-set-size', offsetCalculationString);
                        childClone.attr('vs-set-size-transform-property', positioningPropertyTransform);
                        childClone.attr('vs-set-size-positioning-property', positioningProperty);

                        $compile(childClone)($scope);
                        $element.append(childClone);

                        $fillElement = angular.element('<div class="vs-repeat-fill-element"></div>')
                            .css({
                                'position':'relative',
                                'min-height': '100%',
                                'min-width': '100%'
                            });
                        $element.append($fillElement);
                        $compile($fillElement)($scope);
                        $scope.$fillElement = $fillElement;

                        var _prevMouse = {};
                        if(isMacOS){
                            $wheelHelper = angular.element('<div class="vs-repeat-wheel-helper"></div>')
                                .on(wheelEventName, function(e){
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if(e.originalEvent) e = e.originalEvent;
                                    $scrollParent[0].scrollLeft += (e.deltaX || -e.wheelDeltaX);
                                    $scrollParent[0].scrollTop += (e.deltaY || -e.wheelDeltaY);
                                }).on('mousemove', function(e){
                                    if(_prevMouse.x !== e.clientX || _prevMouse.y !== e.clientY)
                                        angular.element(this).css('display', 'none');
                                    _prevMouse = {
                                        x: e.clientX,
                                        y: e.clientY
                                    };
                                }).css('display', 'none');
                            $fillElement.append($wheelHelper);
                        }

                        $scope.startIndex = 0;
                        $scope.endIndex = 0;

                        $scrollParent.on('scroll', function scrollHandler(e){
                            // Check if the scrolling was triggerred by a local action to avoid
                            // unnecessary inner collection updating
                            if (localScrollTrigger) {
                                localScrollTrigger = false;
                            }
                            else {
                                if(updateInnerCollection()) {
                                    $scope.$apply();
                                    $scope.$broadcast('vsSetSize-refresh');
                                    // $scope.$digest();
                                }
                            }
                        });

                        if(isMacOS){
                            $scrollParent.on(wheelEventName, wheelHandler);
                        }
                        function wheelHandler(e){
                            var elem = e.currentTarget;
                            if(elem.scrollWidth > elem.clientWidth || elem.scrollHeight > elem.clientHeight)
                                $wheelHelper.css('display', 'block');
                        }

                        function onWindowResize(){
                            if(typeof $attrs.vsAutoresize !== 'undefined'){
                                autoSize = true;
                                setAutoSize();
                                if($scope.$root && !$scope.$root.$$phase)
                                    $scope.$apply();
                            }
                            if(updateInnerCollection())
                                $scope.$apply();
                        }

                        angular.element(window).on('resize', onWindowResize);
                        $scope.$on('$destroy', function(){
                            angular.element(window).off('resize', onWindowResize);
                        });

                        $scope.$on('vsRepeatTrigger', refresh);

                        $scope.$on('vsRepeatResize', function(){
                            autoSize = true;
                            setAutoSize();
                        });

                        var _prevStartIndex,
                            _prevEndIndex;
                        function reinitialize(data){
                            _prevStartIndex = void 0;
                            _prevEndIndex = void 0;
                            updateInnerCollection(data);
                            resizeFillElement(sizesPropertyExists ?
                                                $scope.sizesCumulative[originalLength] :
                                                $scope.elementSize*originalLength
                                            );
                            $scope.$broadcast('vsSetSize-refresh');
                            $scope.$emit('vsRepeatReinitialized', $scope.startIndex, $scope.endIndex);
                        }

                        function resizeFillElement(size){
                            if($$horizontal){
                                $fillElement.css({
                                    'width': $scope.offsetBefore + size + $scope.offsetAfter + 'px',
                                    'height': '100%'
                                });
                                if($ctrl && $ctrl.$fillElement){
                                    var referenceElement = $ctrl.$fillElement[0].parentNode.querySelector('[ng-repeat]');
                                    if(referenceElement)
                                        $ctrl.$fillElement.css({
                                            'width': referenceElement.scrollWidth + 'px'
                                        });
                                }
                            }
                            else{
                                $fillElement.css({
                                    'height': $scope.offsetBefore + size + $scope.offsetAfter + 'px',
                                    'width': '100%'
                                });
                                if($ctrl && $ctrl.$fillElement){
                                    referenceElement = $ctrl.$fillElement[0].parentNode.querySelector('[ng-repeat]');
                                    if(referenceElement)
                                        $ctrl.$fillElement.css({
                                            'height': referenceElement.scrollHeight + 'px'
                                        });
                                }
                            }
                        }

                        var _prevClientSize;
                        function reinitOnClientHeightChange(){
                            var ch = getClientSize($scrollParent[0], clientSize);
                            if(ch !== _prevClientSize){
                                reinitialize();
                                if($scope.$root && !$scope.$root.$$phase)
                                    $scope.$apply();
                            }
                            _prevClientSize = ch;
                        }

                        $scope.$watch(function(){
                            if(typeof window.requestAnimationFrame === "function")
                                window.requestAnimationFrame(reinitOnClientHeightChange);
                            else
                                reinitOnClientHeightChange();
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

                        function updateInnerCollection(data){
                            var $scrollPosition = getScrollPos($scrollParent[0], scrollPos);
                            var $clientSize = getClientSize($scrollParent[0], clientSize);

                            var scrollOffset = getScrollOffset(
                                                    $element[0],
                                                    $scrollParent[0],
                                                    $$horizontal
                                                );

                            var scrollChange = true,
                                position,
                                visibleStartIndex,
                                scrollIndexCumulativeSize,
                                scrollIndexSize;

                            if (data && data.elementSize !== undefined) $scope.elementSize = data.elementSize;

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
                                // position === getClientSize($scrollParent[0], clientSize) means the bottom
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
                                                    position = (getClientSize($scrollParent[0], clientSize) - scrollIndexSize) / 2;
                                                    break;
                                                case 'bottom':
                                                    position = getClientSize($scrollParent[0], clientSize) - scrollIndexSize - $scope.offsetAfter;
                                                    break;
                                                case 'inview':
                                                case 'inview#top':
                                                case 'inview#middle':
                                                case 'inview#bottom':
                                                case 'inview#auto':
                                                    // The item is in the viewport, do nothing
                                                    if (
                                                            ($scrollParent[0][scrollPos] <= (scrollIndexCumulativeSize)) &&
                                                            ($scrollParent[0][scrollPos] + getClientSize($scrollParent[0], clientSize) - scrollIndexSize >= scrollIndexCumulativeSize)) {
                                                        scrollChange = false;
                                                        // The current item scroll position
                                                        position = scrollIndexCumulativeSize - $scrollParent[0][scrollPos];
                                                    }
                                                    // The item is out of the viewport
                                                    else {
                                                        if (data.scrollIndexPosition === 'inview#top' ||  data.scrollIndexPosition === 'inview') {
                                                            // Get it at the top
                                                            position = $scope.offsetBefore;
                                                        }
                                                        if (data.scrollIndexPosition === 'inview#bottom') {
                                                            // Get it at the bottom
                                                            position = getClientSize($scrollParent[0], clientSize) - scrollIndexSize + $scope.offsetAfter;
                                                        }
                                                        if (data.scrollIndexPosition === 'inview#middle') {
                                                            // Get it at the middle
                                                            position = (getClientSize($scrollParent[0], clientSize) - scrollIndexSize) / 2;
                                                        }
                                                        if (data.scrollIndexPosition === 'inview#auto') {
                                                            // Get it at the bottom or at the top, depending on what is closer
                                                            if ($scrollParent[0][scrollPos] <= scrollIndexCumulativeSize) {
                                                                position = getClientSize($scrollParent[0], clientSize) - scrollIndexSize + $scope.offsetAfter;
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

                                $scope.startIndex = data.scrollIndex;

                                if(sizesPropertyExists){

                                    while($scope.sizesCumulative[$scope.startIndex] > $scope.sizesCumulative[data.scrollIndex] - position)
                                    {
                                        $scope.startIndex--;
                                    }
                                    // The real first item in the view
                                    visibleStartIndex = Math.max($scope.startIndex, 0);

                                    // Adjust the start index according to the excess
                                    $scope.startIndex = Math.max(
                                        Math.floor($scope.startIndex - ($scope.excess / 2)),
                                        0
                                    );

                                    $scope.endIndex = $scope.startIndex;
                                    while($scope.sizesCumulative[$scope.endIndex] < $scope.sizesCumulative[visibleStartIndex] - $scope.offsetBefore + getClientSize($scrollParent[0], clientSize)) {
                                        $scope.endIndex++;
                                    }
                                    // Adjust the end index according to the excess
                                    $scope.endIndex = Math.min(
                                        Math.ceil($scope.endIndex + ($scope.excess / 2)),
                                        originalLength
                                    );

                                }
                                else {

                                    while(($scope.startIndex * $scope.elementSize) > (data.scrollIndex * $scope.elementSize) - position)
                                    {
                                        $scope.startIndex--;
                                    }
                                    // The real first item in the view
                                    visibleStartIndex = Math.max($scope.startIndex, 0);
                                    $scope.startIndex = Math.max(
                                        Math.floor($scope.startIndex - ($scope.excess / 2)),
                                        0
                                    );

                                    $scope.endIndex = Math.min(
                                        $scope.startIndex + Math.ceil(getClientSize($scrollParent[0], clientSize) / $scope.elementSize) + $scope.excess / 2,
                                        originalLength
                                    );

                                }
                            }
                            else {

                                if(sizesPropertyExists){
                                    $scope.startIndex = 0;
                                    while($scope.sizesCumulative[$scope.startIndex] < $scrollPosition - $scope.offsetBefore - scrollOffset) {
                                        $scope.startIndex++;
                                    }
                                    if($scope.startIndex > 0) { $scope.startIndex--; }
                                    // Adjust the start index according to the excess
                                    $scope.startIndex = Math.max(
                                        Math.floor($scope.startIndex - $scope.excess / 2),
                                        0
                                    );

                                    $scope.endIndex = $scope.startIndex;
                                    while($scope.sizesCumulative[$scope.endIndex] < $scrollPosition - $scope.offsetBefore - scrollOffset + $clientSize) {
                                        $scope.endIndex++;
                                    }
                                    // Adjust the end index according to the excess
                                    $scope.endIndex = Math.min(
                                        Math.ceil($scope.endIndex + $scope.excess / 2),
                                        originalLength
                                    );
                                }
                                else{
                                    $scope.startIndex = Math.max(
                                        Math.floor(
                                            ($scrollPosition - $scope.offsetBefore - scrollOffset) / $scope.elementSize + $scope.excess / 2
                                        ) - $scope.excess,
                                        0
                                    );

                                    // var renderViewPortSize = getRenderViewPortSize(
                                    //                             $element[0],
                                    //                             $scrollParent[0],
                                    //                             $$horizontal
                                    //                         );
                                    // console.log(renderViewPortSize);
                                    $scope.endIndex = Math.min(
                                        $scope.startIndex + Math.ceil(
                                            getClientSize($scrollParent[0], clientSize) / $scope.elementSize
                                        ) + $scope.excess,
                                        originalLength
                                    );
                                }
                            }

                            var scrolled = false;
                            if (data !== undefined && data.scrollIndex !== undefined && position !== undefined && scrollChange) {
                                // Scroll to the requested position
                                scrolled = scrollToPosition(scrollIndexCumulativeSize - position);
                            }

                            var digestRequired = $scope.startIndex !== _prevStartIndex || $scope.endIndex !== _prevEndIndex;

                            if(digestRequired) {
                                $scope[collectionName] = originalCollection.slice($scope.startIndex, $scope.endIndex);

                                // Emit the event
                                $scope.$emit('vsRepeatInnerCollectionUpdated', $scope.startIndex, $scope.endIndex, _prevStartIndex, _prevEndIndex);
                            }

                            _prevStartIndex = $scope.startIndex;
                            _prevEndIndex = $scope.endIndex;

                            return digestRequired;
                        }
                    }
                };
            }
        };
    }]).directive('vsSetSize', [function(){
        return function($scope, $element, $attrs){
            var positioningPropertyTransform = $attrs.vsSetSizeTransformProperty;
            var positioningProperty = $attrs.vsSetSizePositioningProperty;

            setOffset();
            $scope.$on('vsSetSize-refresh', setOffset);

            function setOffset(){
                var offset = $scope.$eval($attrs.vsSetSize);
                if(typeof document.documentElement.style.transform !== "undefined"){ // browser supports transform css property
                    $element.css('transform', positioningPropertyTransform + '(' + offset + 'px)');
                }
                else if(typeof document.documentElement.style.webkitTransform !== "undefined"){ // browser supports -webkit-transform css property
                    $element.css('-webkit-transform', positioningPropertyTransform + '(' + offset + 'px)');
                }
                else{
                    $element.css(positioningProperty, offset + 'px');
                }
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
})(window, window.angular);