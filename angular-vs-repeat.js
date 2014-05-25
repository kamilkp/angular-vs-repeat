//
// Copyright Kamil Pękala http://github.com/kamilkp
// Angular Virtual Scroll Repeat v0.2 2014/05/25
//

(function(window, angular){
	'use strict';

	// DESCRIPTION:
	// vsRepeat directive stands for Virtual Scroll Repeat. It turns a standard ngRepeated set of elements in a scrollable container
	// into a component, where the user thinks he has all the elements rendered and all he needs to do is scroll (without any kind of
	// pagination - which most users loath) and at the same time the browser isn't overloaded by that many elements/angular bindings etc.
	// The directive renders only so many elements that can fit into current container's clientHeight/clientWidth.

	// LIMITATIONS:
	// - current version only supports an Array as a right-hand-side object for ngRepeat
	// - all rendered elements must have the same predefined height/width

	// USAGE:
	// In order to use the vsRepeat directive you need to measure the single element's height/width (including all paddings and margins).
	// You can use any kind of developer tools you like. Let's say that that height is 50px.
	// example:
	// <div vs-repeat="50">
	//		<div ng-repeat="item in someArray">
	//			<!-- content -->
	//		</div>
	// </div>
	// 
	// - the vsRepeat directive must be applied to a direct parent of an element with ngRepeat
	// - the value of vsRepeat attribute is the single element's height/width measured in pixels
	
	// OPTIONAL PARAMETERS (attributes):
	// vs-scroll-parent="selector" - selector to the scrollable container. The directive will look for a closest parent matching
	//								he given selector (defaults to the current element)
	// vs-horizontal - stack repeated elements horizontally instead of vertically
	// vs-offset-before="value" - top/left offset in pixels (defaults to 0)
	// vs-offset-after="value" - bottom/right offset in pixels (defaults to 0)
	// vs-excess="value" - an integer number representing the number of elements to be rendered outside of the current container's viewport
	// 						(defaults to 2)

	// EVENTS:
	// - 'vsRepeatTrigger' - an event the directive listens for to manually trigger reinitialization
	// - 'vsRepeatReinitialized' - an event the directive emits upon reinitialization done

	var isMacOS = navigator.appVersion.indexOf('Mac') != -1,
		wheelEventName = typeof window.onwheel !== 'undefined' ? 'wheel' : typeof window.onmousewheel !== 'undefined' ? 'mousewheel' : 'DOMMouseScroll';
	angular.module('vs-repeat', []).directive('vsRepeat', ['$compile', function($compile){
		return {
			restrict: 'A',
			scope: true,
			compile: function($element, $attrs){
				var ngRepeatChild = $element.children().eq(0),
					ngRepeatExpression = ngRepeatChild.attr('ng-repeat'),
					childCloneHtml = ngRepeatChild[0].outerHTML,
					expressionMatches = /^\s*(\S+)\s+in\s+(\S+)\s*(track\s+by\s+\S+)?/.exec(ngRepeatExpression),
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
					pre: function($scope, $element, $attrs){
						var childClone = angular.element(childCloneHtml),
							originalCollection = [],
							originalLength,
							$$horizontal = typeof $attrs.vsHorizontal !== "undefined",
							$wheelHelper,
							$fillElement,
							$scrollParent = $attrs.vsScrollParent ? $element.closest($attrs.vsScrollParent) : $element,
							positioningProperty = $$horizontal ? 'left' : 'top',
							clientSize =  $$horizontal ? 'clientWidth' : 'clientHeight',
							scrollPos =  $$horizontal ? 'scrollLeft' : 'scrollTop';

						Object.keys(attributesDictionary).forEach(function(key){
							if(typeof $attrs[key] !== "undefined"){
								$attrs.$observe(key, function(value){
									$scope[attributesDictionary[key]] = Number(value);
									reinitialize();
								});
							}
						});

						$scope.elementSize = parseInt($attrs.vsRepeat, 10);
						$scope.offsetBefore = $attrs.vsOffsetBefore ? parseInt($attrs.vsOffsetBefore, 10) : 0;
						$scope.offsetAfter = $attrs.vsOffsetAfter ? parseInt($attrs.vsOffsetAfter, 10) : 0;
						$scope.excess = $attrs.vsExcess ? parseInt($attrs.vsExcess, 10) : 2;

						$scope.$watchCollection(rhs, function(coll){
							originalCollection = coll || [];
							if(!originalCollection || originalCollection.length < 1){
								$scope[collectionName] = [];
								originalLength = 0;
								if($$horizontal)
									$fillElement.css({
										'width': $scope.offsetBefore + $scope.offsetAfter + 'px',
										'height': '100%'
									});
								else
									$fillElement.css({
										'height': $scope.offsetBefore + $scope.offsetAfter + 'px'
									});
								return;
							}
							else{
								originalLength = originalCollection.length;
							}
							reinitialize();
						});

						childClone.attr('ng-repeat', lhs + ' in ' + collectionName + (rhsSuffix ? ' ' + rhsSuffix : ''))
								.attr('ng-style', '{' + positioningProperty + ': (($index + startIndex) * elementSize + offsetBefore) + "px"}')
								.attr('style', 'position: absolute;');
						$compile(childClone)($scope);
						$element.append(childClone);

						$fillElement = angular.element('<div class="vs-repeat-fill-element"></div>')
							.css({'position':'relative'});
						$element.append($fillElement);

						var _prevMouse = {};
						if(isMacOS){
							$wheelHelper = angular.element('<div class="vs-repeat-wheel-helper"></div>')
								.on(wheelEventName, function(e){
									e.preventDefault();
									e.stopPropagation();
									if(e.originalEvent) e = e.originalEvent;
									if($$horizontal)
										$scrollParent[0].scrollLeft += (e.deltaX || -e.wheelDeltaX);
									else
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
							if(updateInnerCollection())
								$scope.$apply();
						});

						if(isMacOS){
							$scrollParent.on(wheelEventName, wheelHandler);
						}
						function wheelHandler(e){
							e.preventDefault();
							$wheelHelper.css('display', 'block');
						}

						function onWindowResize(){
							if(updateInnerCollection())
								$scope.$apply();
						}

						angular.element(window).on('resize', onWindowResize);
						$scope.$on('$destroy', function(){
							angular.element(window).off('resize', onWindowResize);
						});

						$scope.$on('vsRepeatTrigger', reinitialize);

						var _prevStartIndex,
							_prevEndIndex;
						function reinitialize(){
							_prevStartIndex = void 0;
							_prevEndIndex = void 0;
							updateInnerCollection();
							if($$horizontal)
								$fillElement.css({
									'width': ($scope.offsetBefore + $scope.elementSize*originalLength + $scope.offsetAfter) + 'px',
									'height': '100%'
								});
							else
								$fillElement.css({
									'height': ($scope.offsetBefore + $scope.elementSize*originalLength + $scope.offsetAfter) + 'px'
								});
							$scope.$emit('vsRepeatReinitialized');
						}

						var _prevClientSize;
						function reinitOnClientHeightChange(){
							var ch = $scrollParent[0][clientSize];
							if(ch !== _prevClientSize){
								reinitialize();
								if(!$scope.$root.$$phase)
									$scope.$digest();
							}
							_prevClientSize = ch;
						}

						$scope.$watch(function(){
							if(typeof window.requestAnimationFrame === "function")
								window.requestAnimationFrame(reinitOnClientHeightChange);
							else
								reinitOnClientHeightChange();
						});

						function updateInnerCollection(){
							$scope.startIndex = Math.max(
								Math.floor(
									($scrollParent[0][scrollPos]) / $scope.elementSize + $scope.excess/2
								) - $scope.excess,
								0
							);
							$scope.endIndex = Math.min(
								$scope.startIndex + Math.ceil(
									$scrollParent[0][clientSize] / $scope.elementSize
								) + $scope.excess,
								originalLength
							);

							var digestRequired = $scope.startIndex !== _prevStartIndex || $scope.endIndex !== _prevEndIndex;

							if(digestRequired)
								$scope[collectionName] = originalCollection.slice($scope.startIndex, $scope.endIndex);

							_prevStartIndex = $scope.startIndex;
							_prevEndIndex = $scope.endIndex;

							return digestRequired;
						}
					}
				};
			}
		};
	}]);

	angular.element(document.head).append([
		'<style>' +
		'.vs-repeat-wheel-helper{' +
		'	position: absolute;' +
		'	top: 0;' +
		'	bottom: 0;' +
		'	left: 0;' +
		'	right: 0;' +
		'	z-index: 99999;' +
		'	background: rgba(0, 0, 0, 0);' +
		'}' +
		'</style>'
	].join(''));
})(window, window.angular);