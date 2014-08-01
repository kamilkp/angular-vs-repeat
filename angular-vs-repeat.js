//
// Copyright Kamil Pękala http://github.com/kamilkp
// Angular Virtual Scroll Repeat v1.0.0-rc5 2014/08/01
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
	//		<div ng-repeat="item in someArray">
	//			<!-- content -->
	//		</div>
	// </div>
	// 
	// You can also measure the single element's height/width (including all paddings and margins), and then speficy it as a value
	// of the attribute 'vs-repeat'. This can be used if one wants to override the automatically computed element size.
	// example:
	// <div vs-repeat="50"> <!-- the specified element height is 50px -->
	//		<div ng-repeat="item in someArray">
	//			<!-- content -->
	//		</div>
	// </div>
	// 
	// IMPORTANT! 
	// 
	// - the vsRepeat directive must be applied to a direct parent of an element with ngRepeat
	// - the value of vsRepeat attribute is the single element's height/width measured in pixels. If none provided, the directive
	//		will compute it automatically
	
	// OPTIONAL PARAMETERS (attributes):
	// vs-scroll-parent="selector" - selector to the scrollable container. The directive will look for a closest parent matching
	//								he given selector (defaults to the current element)
	// vs-horizontal - stack repeated elements horizontally instead of vertically
	// vs-offset-before="value" - top/left offset in pixels (defaults to 0)
	// vs-offset-after="value" - bottom/right offset in pixels (defaults to 0)
	// vs-excess="value" - an integer number representing the number of elements to be rendered outside of the current container's viewport
	//						(defaults to 2)
	// vs-size-property - a property name of the items in collection that is a number denoting the element size (in pixels)
	// vs-autoresize - use this attribute without vs-size-property and without specifying element's size. The automatically computed element style will
	//				readjust upon window resize if the size is dependable on the viewport size

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
					ngRepeatExpression = ngRepeatChild.attr('ng-repeat'),
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
							sizesPropertyExists = !!$attrs.vsSizeProperty,
							$scrollParent = $attrs.vsScrollParent ? closestElement.call($element, $attrs.vsScrollParent) : $element,
							positioningPropertyTransform = $$horizontal ? 'translateX' : 'translateY',
							positioningProperty = $$horizontal ? 'left' : 'top',

							clientSize =  $$horizontal ? 'clientWidth' : 'clientHeight',
							offsetSize =  $$horizontal ? 'offsetWidth' : 'offsetHeight',
							scrollPos =  $$horizontal ? 'scrollLeft' : 'scrollTop';

						if($scrollParent.length === 0) throw 'Specified scroll parent selector did not match any element';
						$scope.$scrollParent = $scrollParent;

						if(sizesPropertyExists) $scope.sizesCumulative = [];

						//initial defaults
						$scope.elementSize = $scrollParent[0][clientSize] || 50;
						$scope.offsetBefore = 0;
						$scope.offsetAfter = 0;
						$scope.excess = 2;

						Object.keys(attributesDictionary).forEach(function(key){
							if($attrs[key]){
								$attrs.$observe(key, function(value){
									$scope[attributesDictionary[key]] = +value;
									reinitialize();
								});
							}
						});


						$scope.$watchCollection(rhs, function(coll){
							originalCollection = coll || [];
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
										return item[$attrs.vsSizeProperty];
									});
									var sum = 0;
									$scope.sizesCumulative = $scope.sizes.map(function(size){
										var res = sum;
										sum += size;
										return res;
									});
									$scope.sizesCumulative.push(sum);
								}
								setAutoSize();
							}
							reinitialize();
						});

						function setAutoSize(){
							if(autoSize){
								$scope.$$postDigest(function(){
									if($element[0].offsetHeight || $element[0].offsetWidth){ // element is visible
										var children = $element.children(),
											i = 0;
										while(i < children.length){
											if(children[i].attributes['ng-repeat'] != null){
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

						if(typeof document.documentElement.style.transform !== "undefined"){ // browser supports transform css property
							childClone.attr('ng-style', '{ "transform": "' + positioningPropertyTransform + '(" + ' + offsetCalculationString + ' + "px)"}');
						}
						else if(typeof document.documentElement.style.webkitTransform !== "undefined"){ // browser supports -webkit-transform css property
							childClone.attr('ng-style', '{ "-webkit-transform": "' + positioningPropertyTransform + '(" + ' + offsetCalculationString + ' + "px)"}');
						}
						else{
							childClone.attr('ng-style', '{' + positioningProperty + ': ' + offsetCalculationString + ' + "px"}');
						}

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
							if(updateInnerCollection())
								$scope.$apply();
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

						$scope.$on('vsRepeatTrigger', reinitialize);
						$scope.$on('vsRepeatResize', function(){
							autoSize = true;
							setAutoSize();
						});

						var _prevStartIndex,
							_prevEndIndex;
						function reinitialize(){
							_prevStartIndex = void 0;
							_prevEndIndex = void 0;
							updateInnerCollection();
							resizeFillElement(sizesPropertyExists ?
												$scope.sizesCumulative[originalLength] :
												$scope.elementSize*originalLength
											);
							$scope.$emit('vsRepeatReinitialized');
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
							var ch = $scrollParent[0][clientSize];
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

						function updateInnerCollection(){
							if(sizesPropertyExists){
								$scope.startIndex = 0;
								while($scope.sizesCumulative[$scope.startIndex] < $scrollParent[0][scrollPos] - $scope.offsetBefore)
									$scope.startIndex++;
								if($scope.startIndex > 0) $scope.startIndex--;

								$scope.endIndex = $scope.startIndex;
								while($scope.sizesCumulative[$scope.endIndex] < $scrollParent[0][scrollPos] - $scope.offsetBefore + $scrollParent[0][clientSize])
									$scope.endIndex++;
							}
							else{
								$scope.startIndex = Math.max(
									Math.floor(
										($scrollParent[0][scrollPos] - $scope.offsetBefore) / $scope.elementSize + $scope.excess/2
									) - $scope.excess,
									0
								);

								$scope.endIndex = Math.min(
									$scope.startIndex + Math.ceil(
										$scrollParent[0][clientSize] / $scope.elementSize
									) + $scope.excess,
									originalLength
								);
							}
							

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