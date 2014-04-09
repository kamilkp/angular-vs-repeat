(function(window, angular){
	'use strict';

	// DESCRIPTION:
	// vsRepeat directive stands for Virtual Scroll Repeat. It turns a standard ngRepeated set of elements in a scrollable container
	// into a component, where the user thinks he has all the elements rendered and all he needs to do is scroll (without any kind of
	// pagination - which most users loath) and at the same time the browser isn't overloaded by that many elements/angular bindings etc.
	// The directive renders only so many elements that can fit into current container's clientHeight.

	// LIMITATIONS:
	// - current version works only for vertically stacked elements
	// - current version only supports an Array as a right-hand-side object for ngRepeat
	// - all rendered elements must have the same predefined height

	// USAGE:
	// First include 'vs-repeat' as a module dependency in your app.
	// Then in order to use the vsRepeat directive you need to measure the single element's height (including all paddings and margins).
	// You can use any kind of developer tools you like. Let's say that that height is 50px.
	// example:
	// <div vs-repeat="50">
	// 		<div ng-repeat="item in someArray">
	// 			<!-- content -->
	// 		</div>
	// </div>
	// 
	// - the vsRepeat directive must be applied to a direct parent of an element with ngRepeat
	// - the value of vsRepeat attribute is the single element's height measured in pixels
	
	// OPTIONAL PARAMETERS (attributes):
	// vs-scroll-parent="selector" - selector to the scrollable container. The directive will look for a closest parent matching
	// 								 the given selector (defaults to the current element)
	// vs-top-offset="value" - top offset in pixels (defaults to 0)
	// vs-excess="value" - an integer number representing the number of elements to be rendered outside of the current container's viewport
	// 					   (defaults to 2)

	// EVENTS:
	// - 'vsRepeatTrigger' - an event the directive listens for to manually trigger reinitialization
	// - 'vsRepeatReinitialized' - an event the directive emits upon reinitialization done

	var isMacOS = navigator.appVersion.indexOf("Mac") != -1;
	angular.module('vs-repeat', []).directive('vsRepeat', ['$compile', function($compile){
		return {
			restrict: 'A',
			scope: true,
			compile: function($element, $attrs){
				var childClone = $element.children().eq(0).clone(),
					ngRepeatExpression = childClone.attr('ng-repeat'),
					expressionMatches = /^\s*(\S+)\s+in\s+(\S+)\s*(track\s+by\s+\S+)?/.exec(ngRepeatExpression),
					lhs = expressionMatches[1],
					rhs = expressionMatches[2],
					rhsSuffix = expressionMatches[3],
					collectionName = '$vs_' + rhs,
					originalCollection = [],
					originalLength,
					$wheelHelper,
					$fillElement;

				$element.empty();
				if(!window.getComputedStyle || window.getComputedStyle($element[0]).position === 'static')
					$element.css('position', 'relative');
				return {
					pre: function($scope, $element, $attrs){
						$scope.elementHeight = parseInt($attrs.vsRepeat, 10);
						var $scrollParent = $attrs.vsScrollParent ? $element.closest($attrs.vsScrollParent) : $element;
						$scope.topOffset = $attrs.vsTopOffset ? parseInt($attrs.vsTopOffset, 10) : 0;
						$scope.excess = $attrs.vsExcess ? parseInt($attrs.vsExcess, 10) : 2;

						$scope.$watchCollection(rhs, function(coll){
							originalCollection = coll || [];
							if(!originalCollection || originalCollection.length < 1){
								$scope[collectionName] = [];
								originalLength = 0;
								return;
							}
							else{
								originalLength = originalCollection.length;
							}
							reinitialize();
						});

						childClone.attr('ng-repeat', lhs + ' in ' + collectionName + (rhsSuffix ? ' ' + rhsSuffix : ''))
								.attr('ng-style', '{top: ($index + startIndex) * elementHeight + topOffset}')
								.attr('style', 'position: absolute;');
						$compile(childClone)($scope);
						$element.append(childClone);

						$fillElement = $('<div class="vs-repeat-fill-element"></div>')
							.prependTo($element)
							.css({'position':'relative'});

						var _prevMouse = {};
						if(isMacOS){
							$wheelHelper = $('<div class="vs-repeat-wheel-helper"></div>')
								.appendTo($fillElement)
								.on('wheel', function(e){
									e.preventDefault();
									e.stopPropagation();
									$scrollParent[0].scrollTop -= e.originalEvent.wheelDeltaY;
								}).on('mousemove', function(e){
									if(_prevMouse.x !== e.clientX || _prevMouse.y !== e.clientY)
										$(this).hide();
									_prevMouse = {
										x: e.clientX,
										y: e.clientY
									};
								}).hide();
						}

						$scope.startIndex = 0;
						$scope.endIndex = 0;

						$scrollParent.on('scroll.vs-repeat', function scrollHandler(e){
							if(updateInnerCollection())
								$scope.$apply();
						});

						if(isMacOS){
							$scrollParent.on('wheel.vs-repeat', wheelHandler);
						}
						function wheelHandler(e){
							e.preventDefault();
							$wheelHelper.show();
						}

						function onWindowResize(){
							if(updateInnerCollection())
								$scope.$apply();
						}

						$(window).on('resize', onWindowResize);

						$scope.$on('$destroy', function(){
							$(window).off('resize', onWindowResize);
						});

						$scope.$on('vsRepeatTrigger', reinitialize);
						var _prevStartIndex,
							_prevEndIndex;
						function reinitialize(){
							_prevStartIndex = void 0;
							_prevEndIndex = void 0;
							updateInnerCollection();
							$fillElement.css({'height': $scope.elementHeight*originalLength});
							$scope.$emit('vsRepeatReinitialized');
						}

						var _prevClientHeight;
						function reinitOnClientHeightChange(){
							var ch = $scrollParent[0].clientHeight;
							if(ch !== _prevClientHeight){
								reinitialize();
								if(!$scope.$root.$$phase)
									$scope.$digest();
							}
							_prevClientHeight = ch;
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
									($scrollParent[0].scrollTop) / $scope.elementHeight + $scope.excess/2
								) - $scope.excess,
								0
							);
							$scope.endIndex = Math.min(
								$scope.startIndex + Math.ceil(
									$scrollParent[0].clientHeight / $scope.elementHeight
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

	$('head').append([
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