(function(){
	'use strict';
	// jshint -W117
	function getArray(size){
		var res = [];
		for(var i=0;i<size;i++){
			res.push({
				value: i,
				size: 110
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

		it('should support manually provided unique element size', function(done){
			$element = $compile([
				'<div vs-repeat="150" class="container">',
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
			expect(elems.length).to.be.lessThan(5);
			done();
		});

		it('should support manually provided size per element', function(done){
			$element = $compile([
				'<div vs-repeat vs-size="size" class="container">',
				'	<div ng-repeat="foo in bar" class="item">',
				'		<span class="value">{{foo.value}}</span>',
				'	</div>',
				'</div>'
			].join(''))($scope);
			angular.element(document.body).append($element);
			$scope.bar = getArray(100);
			$scope.$digest();
			$scope.$broadcast('vsRepeatTrigger');
			$scope.$digest();

			var elems = getElements($element);
			expect(elems.length).to.be.greaterThan(1);
			expect(elems.length).to.be.lessThan(5);
			done();
		});

		it('should support angular expression as vs-size attribute value', function(done){
			$element = $compile([
				'<div vs-repeat vs-size="2*size - 10" class="container">',
				'	<div ng-repeat="foo in bar" class="item">',
				'		<span class="value">{{foo.value}}</span>',
				'	</div>',
				'</div>'
			].join(''))($scope);
			angular.element(document.body).append($element);
			$scope.bar = getArray(100);
			$scope.$digest();
			$scope.$broadcast('vsRepeatTrigger');
			$scope.$digest();

			var elems = getElements($element);
			expect(elems.length).to.be.greaterThan(1);
			expect(elems.length).to.be.lessThan(3);
			done();
		});

		it('should support latching mode', function(done){
			$element = $compile([
				'<div vs-repeat vs-size="size" vs-options="{latch: true}" class="container">',
				'	<div ng-repeat="foo in bar" class="item">',
				'		<span class="value">{{foo.value}}</span>',
				'	</div>',
				'</div>'
			].join(''))($scope);
			angular.element(document.body).append($element);
			$scope.bar = getArray(100);
			$scope.$digest();
			$scope.$broadcast('vsRepeatTrigger');
			$scope.$digest();

			var elems = getElements($element);
			expect(elems.length).to.be.greaterThan(1);
			expect(elems.length).to.be.lessThan(5);

			$element[0].scrollTop = 3000;
			$element.triggerHandler('scroll');
			expect(getElements($element).length).to.be.greaterThan(20);
			done();
		});

		it('should support changing manually provided size per element', function(done){

			$element = $compile([
				'<div vs-repeat vs-size="size" class="container">',
				'	<div ng-repeat="foo in bar" class="item">',
				'		<span class="value">{{foo.value}}</span>',
				'	</div>',
				'</div>'
			].join(''))($scope);
			angular.element(document.body).append($element);
			$scope.bar = getArray(100);
			$scope.$digest();
			$scope.$broadcast('vsRepeatTrigger');
			$scope.$digest();

			var elems = getElements($element);
			expect(elems.length).to.be.greaterThan(1);
			expect(elems.length).to.be.lessThan(5);

			// Change first item size and trigger refresh
			var newSize = 123;
			$scope.bar[0].size = newSize;
			$scope.$digest();
			$scope.$broadcast('vsRepeatTrigger');
			$scope.$digest();

			// Second item should have shifted
			elems = getElements($element);
			expect(elems.length).to.be.greaterThan(1);
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

        it ('should support ngRepeater container selector', function (done) {
            $element = angular.element([
                '	<div vs-repeat vs-repeat-container=".container">',
                '	    <div class="container">',
                '		    <div ng-repeat="foo in bar" class="item">',
                '			    <span class="value">{{foo.value}}</span>',
                '		    </div>',
                '	    </div>',
                '	</div>'
            ].join(''));

            angular.element(document.body).append($element);
            $compile($element)($scope);
            $scope.bar = getArray(100);
            $scope.$digest();

            var elems, count;

            elems = getElements($element);
            count = elems.length;
            expect(count).to.be.greaterThan(0);
            expect(count).to.be.lessThan(20);

            done();
        });

        it ('should execute function when scrolled to offset', function (done) {
            $element = angular.element([
                '	<div vs-repeat="20" vs-scrolled-to-end="updateCounter()" vs-scrolled-to-end-offset="20" class="container">',
                '       <div ng-repeat="foo in bar" class="item">',
                '		    <span class="value">{{foo.value}}</span>',
                '		</div>',
                '	</div>'
            ].join(''));

            angular.element(document.body).append($element);
            $compile($element)($scope);
            $scope.bar = getArray(100);
            $scope.$digest();

            var counter = 0;
            $scope.updateCounter = function(){
                counter += 1;
            };

            $element[0].scrollTop = $element[0].scrollHeight * 0.6;
            $element.triggerHandler('scroll');
            $scope.$digest();

            expect(counter).to.be(0);

            $element[0].scrollTop = $element[0].scrollHeight * 0.8;
            $element.triggerHandler('scroll');
            $scope.$digest();

            expect(counter).to.be(1);

            done();
        });
    });
})();