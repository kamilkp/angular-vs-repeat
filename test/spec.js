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
			beforeEach(function(){
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
			});
			it('should render only a few elements', function(done) {
				var elems, values1, values2, count;

				elems = $element[0].querySelectorAll('[ng-repeat] .value');
				values1 = Array.prototype.map.call(elems, function(elem){
					return +elem.innerHTML.trim();
				});
				count = elems.length;
				expect(count).to.be.greaterThan(0);
				expect(count).to.be.lessThan(20);

				$element[0].scrollTop += 200;
				$element[0].scrollLeft += 200;

				$element.triggerHandler('scroll');

				elems = $element[0].querySelectorAll('[ng-repeat] .value');
				values2 = Array.prototype.map.call(elems, function(elem){
					return +elem.innerHTML.trim();
				});
				expect(Math.min.apply(Math, values1)).to.be.lessThan(Math.min.apply(Math, values2));
				
				count = elems.length;
				expect(count).to.be.greaterThan(0);
				expect(count).to.be.lessThan(20);

				done();
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

			elems = $element[0].querySelectorAll('[ng-repeat] .value');
			values1 = Array.prototype.map.call(elems, function(elem){
				return +elem.innerHTML.trim();
			});
			count = elems.length;
			expect(count).to.be.greaterThan(0);
			expect(count).to.be.lessThan(20);

			$element[0].scrollTop += 200;
			$element[0].scrollLeft += 200;

			$element.triggerHandler('scroll');

			elems = $element[0].querySelectorAll('[ng-repeat] .value');
			values2 = Array.prototype.map.call(elems, function(elem){
				return +elem.innerHTML.trim();
			});
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
	});
})();