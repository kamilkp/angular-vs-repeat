(function(){
	'use strict';
	// jshint -W117
	function getArray(size){
		var res = [];
		for(var i=0;i<size;i++){
			res.push({
				value: i
			});
		}
		return res;
	}

	function getElements($element){
		return $element[0].querySelectorAll('[ng-repeat] .value');
	}

	function getValues(elems){
		return Array.prototype.map.call(elems, function(elem){
			return +elem.innerHTML.trim();
		});
	}

	var animationFrame = 1000/60;

	describe('vs-repeat', function(){
		// this.timeout(1000000);
		var $compile,
			$element,
			$scope,
			$timeout;

		beforeEach(angular.mock.module('vs-repeat'));
		beforeEach(inject(function($injector, $rootScope){
			$compile = $injector.get('$compile');
			$timeout = $injector.get('$timeout');
			$element = null;
			$scope = $rootScope.$new();
			angular.element(document.head).append([
				'<style>',
				'	.container{',
				'		max-height: 200px;',
				'		max-width: 200px;',
				'		overflow: auto;',
				'		background: hsla(60, 100%, 50%, 0.3);',
				'	}',
				'	.scroll{',
				'		max-height: 100px;',
				'		max-width: 200px;',
				'		overflow: auto;',
				'		background: hsla(60, 100%, 50%, 0.3);',
				'	}',
				'	.container.horizontal{',
				'		height: 200px;',
				'	}',
				'	.item{',
				'		width: 100%;',
				'	}',
				'	.horizontal .item{',
				'		display: inline-block;',
				'		width: 20px;',
				'		height: 100%;',
				'	}',
				'</style>'
			].join(''));
		}));
		afterEach(function(){
			if($element)
				$element.remove();
			$scope.$destroy();
		});
		describe('automatic size', function(){
			it('should render only a few elements', function(done) {
				$element = $compile([
					'<div vs-repeat class="container">',
					'	<div ng-repeat="foo in bar" class="item">',
					'		<span class="value">{{foo.value}}</span>',
					'	</div>',
					'</div>'
				].join(''))($scope);
				angular.element(document.body).append($element);
				$scope.bar = getArray(100);
				$scope.$digest();

				var elems, values1, values2, count;

				elems = getElements($element);
				values1 = getValues(elems);
				count = elems.length;
				expect(count).to.be.greaterThan(0);
				expect(count).to.be.lessThan(20);

				$element[0].scrollTop += 200;
				$element[0].scrollLeft += 200;

				$element.triggerHandler('scroll');

				elems = getElements($element);
				values2 = getValues(elems);
				expect(Math.min.apply(Math, values1)).to.be.lessThan(Math.min.apply(Math, values2));
				
				count = elems.length;
				expect(count).to.be.greaterThan(0);
				expect(count).to.be.lessThan(20);

				done();
			});
			it('should support rendering initially hidden element', function(done){
				$element = $compile([
					'<div ng-show="showFlag">',
					'	<div vs-repeat class="container">',
					'		<div ng-repeat="foo in bar" class="item">',
					'			<span class="value">{{foo.value}}</span>',
					'		</div>',
					'	</div>',
					'</div>'
				].join(''))($scope);
				angular.element(document.body).append($element);
				$scope.bar = getArray(100);
				$scope.showFlag = false;
				$scope.$digest();

				setTimeout(function(){
					var elems = getElements($element);
					expect(elems.length).to.be.greaterThan(0);
					expect(elems.length).to.be.lessThan(4);

					$scope.showFlag = true;
					$scope.$digest();
					setTimeout(function(){
						elems = getElements($element);
						expect(elems.length).to.be.greaterThan(3);
						done();
					}, animationFrame);
				}, animationFrame);
			});
		});
		it('should support horizontal stacking of elements', function(done){
			$element = $compile([
				'<div vs-repeat class="container horizontal" vs-horizontal>',
				'	<div ng-repeat="foo in bar" class="item">',
				'		<span class="value">{{foo.value}}</span>',
				'	</div>',
				'</div>'
			].join(''))($scope);
			angular.element(document.body).append($element);
			$scope.bar = getArray(100);
			$scope.$digest();

			var elems, values1, values2, count;

			elems = getElements($element);
			values1 = getValues(elems);
			count = elems.length;
			expect(count).to.be.greaterThan(0);
			expect(count).to.be.lessThan(20);

			$element[0].scrollTop += 200;
			$element[0].scrollLeft += 200;

			$element.triggerHandler('scroll');

			elems = getElements($element);
			values2 = getValues(elems);
			expect(Math.min.apply(Math, values1)).to.be.lessThan(Math.min.apply(Math, values2));
			
			count = elems.length;
			expect(count).to.be.greaterThan(0);
			expect(count).to.be.lessThan(20);

			done();
		});
		it('fill element should not obscure repeated elements', function(done){
			$element = $compile([
				'<div vs-repeat class="container">',
				'	<div ng-repeat="foo in bar" class="item">',
				'		<span class="value">{{foo.value}}</span>',
				'	</div>',
				'</div>'
			].join(''))($scope);
			angular.element(document.body).append($element);
			$scope.bar = getArray(100);
			$scope.$digest();

			var rect = $element[0].getBoundingClientRect();
			var fromPoint = document.elementFromPoint(
				~~(rect.left + rect.width/2),
				~~(rect.top + rect.height/2)
			);
			expect(fromPoint.className).not.to.contain('vs-repeat-fill-element');
			done();
		});
		it('should support manually provided element size', function(done){
			$element = $compile([
				'<div vs-repeat="100" class="container">',
				'	<div ng-repeat="foo in bar" class="item">',
				'		<span class="value">{{foo.value}}</span>',
				'	</div>',
				'</div>'
			].join(''))($scope);
			angular.element(document.body).append($element);
			$scope.bar = getArray(100);
			$scope.$digest();

			var elems = getElements($element);
			expect(elems.length).to.be.greaterThan(1);

			var eStyle = elems[1].parentNode.style;
			if(eStyle.transform){
				expect(+eStyle.transform.slice(11, -3)).to.be(100);
			}
			else if(eStyle.webkitTransform){
				expect(+eStyle.webkitTransform.slice(11, -3)).to.be(100);
			}
			else{
				expect(+eStyle.top.slice(0, -2)).to.be(100);
			}
			expect(elems.length).to.be.lessThan(5);
			done();
		});
		it('should support non-default scrollable container', function(done){
			$element = angular.element([
				'<div class="scroll">',
				'	<div vs-repeat vs-scroll-parent=".scroll">',
				'		<div ng-repeat="foo in bar" class="item">',
				'			<span class="value">{{foo.value}}</span>',
				'		</div>',
				'	</div>',
				'</div>'
			].join(''));
			angular.element(document.body).append($element);
			$compile($element)($scope);
			$scope.bar = getArray(100);
			$scope.$digest();

			var elems, values1, values2, count;

			elems = getElements($element);
			values1 = getValues(elems);
			count = elems.length;
			expect(count).to.be.greaterThan(0);
			expect(count).to.be.lessThan(20);

			$element[0].scrollTop += 200;
			$element[0].scrollLeft += 200;

			$element.triggerHandler('scroll');

			elems = getElements($element);
			values2 = getValues(elems);
			expect(Math.min.apply(Math, values1)).to.be.lessThan(Math.min.apply(Math, values2));
			
			count = elems.length;
			expect(count).to.be.greaterThan(0);
			expect(count).to.be.lessThan(20);

			done();
		});
		it('should call vs-on-index-change when the indexes change', function() {
			$element = $compile([
				'<div vs-repeat class="container" vs-on-index-change="loadMoreItems(startIndex, endIndex)">',
				'	<div ng-repeat="foo in bar" class="item">',
				'		<span class="value">{{foo.value}}</span>',
				'	</div>',
				'</div>'
			].join(''))($scope);
			angular.element(document.body).append($element);
			var elScope = $element.scope();
			$scope.bar = getArray(100);
			var calledCount = 0;
			$scope.loadMoreItems = function loadMoreItems(startIndex, endIndex) {
				expect(startIndex).to.not.be(undefined);
				expect(endIndex).to.not.be(undefined);
				calledCount++;
			};

			$scope.$digest();
			expect(calledCount).to.be(2); // the endIndex gets updated twice in the previous digest.

			elScope.endIndex += 10;
			$scope.$digest();
			expect(calledCount).to.be(3);

			elScope.endIndex += 10;
			$scope.$digest();
			expect(calledCount).to.be(4);
		});
	});
})();