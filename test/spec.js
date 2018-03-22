/* global setInterval, console */

(() => {
  function stall() {
    setInterval(() => console.log(1), 1000);
    this.timeout(99999999999);
  }

  function getArray(size){
    const res = [];
    for (let i = 0; i < size; i++){
      res.push({
        value: i,
        size: 110,
      });
    }

    return res;
  }

  const getElements = $element => $element[0].querySelectorAll('.value');

  function getValues(elems){
    return Array.prototype.map.call(elems, function(elem){
      return +elem.innerHTML.trim();
    });
  }

  var animationFrame = 1000 / 60;

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
        `<style>
         	.container{
         		max-height: 200px;
         		max-width: 200px;
         		overflow: auto;
         		background: hsla(60, 100%, 50%, 0.3);
         	}
         	.scroll{
         		max-height: 100px;
         		max-width: 200px;
         		overflow: auto;
         		background: hsla(60, 100%, 50%, 0.3);
         	}
         	.container.horizontal{
            height: 200px;
            display: flex;
            flex-flow: row nowrap;
         	}
         	.item{
             width: 100%;
             height: 20px;
         	}
         	.horizontal .item{
            display: inline-block;
            width: auto;
         		min-width: 20px;
         		height: 100%;
         	}
        </style>`,
      ].join(''));
    }));
    afterEach(function(){
      if ($element)
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
          '</div>',
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
          '</div>',
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
        '<div vs-repeat="{horizontal: true}" class="container horizontal">',
        '	<div ng-repeat="foo in bar" class="item">',
        '		<span class="value">{{foo.value}}</span>',
        '	</div>',
        '</div>',
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
        '<div vs-repeat="{size: 150}" class="container">',
        '	<div ng-repeat="foo in bar" class="item" ng-style="{height: \'150px\'}">',
        '		<span class="value">{{foo.value}}</span>',
        '	</div>',
        '</div>',
      ].join(''))($scope);
      angular.element(document.body).append($element);
      $scope.bar = getArray(100);
      $scope.$digest();

      setTimeout(() => {
        var elems = getElements($element);
        expect(elems.length).to.equal(2);
        done();
      });
    });

    it('should support manually provided size per element', function(done){
      $element = $compile([
        '<div vs-repeat="{size: \'foo.size\'}" class="container">',
        '	<div ng-repeat="foo in bar" class="item">',
        '		<span class="value">{{foo.value}}</span>',
        '	</div>',
        '</div>',
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
        '<div vs-repeat="{size: \'2*foo.size - 10\'}" class="container">',
        '	<div ng-repeat="foo in bar" class="item" ng-style="{ height: (2*foo.size - 10) + \'px\' }">',
        '		<span class="value">{{foo.value}}</span>',
        '	</div>',
        '</div>',
      ].join(''))($scope);
      angular.element(document.body).append($element);
      $scope.bar = getArray(100);
      $scope.$digest();
      $scope.$broadcast('vsRepeatTrigger');
      $scope.$digest();

      var elems = getElements($element);
      expect(elems.length).to.be.greaterThan(0);
      expect(elems.length).to.be.lessThan(3);
      done();
    });

    it('should support latching mode', function(done){
      $element = $compile([
        '<div vs-repeat="{size: \'foo.size\', latch: true}" class="container">',
        '	<div ng-repeat="foo in bar" class="item" ng-style="{ height: foo.size + \'px\' }">',
        '		<span class="value">{{foo.value}}</span>',
        '	</div>',
        '</div>',
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
        '<div vs-repeat="{size: \'foo.size\'}" class="container">',
        '	<div ng-repeat="foo in bar" class="item" ng-style="{ height: foo.size + \'px\' }">',
        '		<span class="value">{{foo.value}}</span>',
        '	</div>',
        '</div>',
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
        '	<div vs-repeat="{scrollParent: \'.scroll\'}">',
        '		<div ng-repeat="foo in bar" class="item">',
        '			<span class="value">{{foo.value}}</span>',
        '		</div>',
        '	</div>',
        '</div>',
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
        '	</div>',
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

    it('should work with ng-repeat-start', function (done) {
      $element = angular.element([
        '	<div vs-repeat vs-repeat-container=".container">',
        '	    <div class="container">',
        '		    <div ng-repeat-start="foo in bar" class="item">',
        '			    <span class="value">{{foo.value}}</span>',
        '		    </div>',
        '		    <div class="item">',
        '			    <span class="value">{{foo.value}}</span>',
        '		    </div>',
        '		    <div ng-repeat-end class="item">',
        '			    <span class="value">{{foo.value}}</span>',
        '		    </div>',
        '	    </div>',
        '	</div>',
      ].join(''));

      angular.element(document.body).append($element);
      $compile($element)($scope);
      $scope.bar = getArray(100);
      $scope.$digest();
      $scope.$digest();

      const elems = getElements($element);
      const count = elems.length;
      expect(count).to.be.greaterThan(0);
      expect(count).to.be.lessThan(20);

      expect($element[0].innerText.startsWith('0\n0\n0')).to.be.true;

      $element.children()[0].scrollTop += 61;
      $element.triggerHandler('scroll');

      setTimeout(() => {
        expect($element[0].innerText.startsWith('1\n1\n1')).to.be.true;
        done();
      });
    });

    it('should execute function when scrolled to end offset', function (done) {
      $element = angular.element([
        '	<div vs-repeat="{size: 20, scrolledToEnd: \'updateCounter()\', scrolledToEndOffset: 20}" class="container">',
        '       <div ng-repeat="foo in bar" class="item" ng-style="{ height: \'20px\' }">',
        '		    <span class="value">{{foo.value}}</span>',
        '		</div>',
        '	</div>',
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

      expect(counter).to.equal(0);

      $element[0].scrollTop = $element[0].scrollHeight * 0.8;
      $element.triggerHandler('scroll');
      $scope.$digest();

      expect(counter).to.equal(1);

      done();
    });

    it ('should execute function when scrolled to beginning offset', function (done) {
      $element = angular.element([
        '	<div vs-repeat="{size: 20, scrolledToBeginning: \'updateCounter()\', scrolledToBeginningOffset: 20}" class="container">',
        '       <div ng-repeat="foo in bar" class="item" ng-style="{ height: \'20px\' }">',
        '		    <span class="value">{{foo.value}}</span>',
        '		</div>',
        '	</div>',
      ].join(''));

      angular.element(document.body).append($element);
      $compile($element)($scope);
      $scope.bar = getArray(100);
      $scope.$digest();

      var counter = 0;
      $scope.updateCounter = function(){
        counter += 1;
      };

      $element[0].scrollTop = $element[0].scrollHeight * 0.8;
      $element.triggerHandler('scroll');
      $scope.$digest();

      expect(counter).to.equal(0);

      $element[0].scrollTop = 0;
      $element.triggerHandler('scroll');
      $scope.$digest();

      expect(counter).to.equal(1);

      done();
    });

    it('should properly calculate start and end index', function (done) {
      $element = angular.element(`
        <div vs-repeat="{size: 20}" class="container" style="height: 200px">
          <div ng-repeat="foo in bar" class="item">
            <span class="value">{{foo.value}}</span>
          </div>
        </div>
      `);

      angular.element(document.body).append($element);
      $compile($element)($scope);
      $scope.bar = getArray(100);
      $scope.$digest();

      let elems = getElements($element);
      let count = elems.length;
      expect(count).to.equal(10);
      expect($element.scope().vsRepeat.startIndex).to.equal(0);
      expect($element.scope().vsRepeat.endIndex).to.equal(10);

      $element[0].scrollTop += 400;
      $element.triggerHandler('scroll');

      elems = getElements($element);
      count = elems.length;
      expect(count).to.equal(10);
      expect($element.scope().vsRepeat.startIndex).to.equal(20);
      expect($element.scope().vsRepeat.endIndex).to.equal(30);

      done();
    });

    it('should properly calculate start and end index with scroll margin', function (done) {
      $element = angular.element(`
        <div vs-repeat="{size: 20, scrollMargin: 40}" class="container" style="height: 200px">
          <div ng-repeat="foo in bar" class="item">
            <span class="value">{{foo.value}}</span>
          </div>
        </div>
      `);

      angular.element(document.body).append($element);
      $compile($element)($scope);
      $scope.bar = getArray(100);
      $scope.$digest();

      let elems = getElements($element);
      let count = elems.length;
      expect(count).to.equal(12);
      expect($element.scope().vsRepeat.startIndex).to.equal(0);
      expect($element.scope().vsRepeat.endIndex).to.equal(12);

      $element[0].scrollTop += 400;
      $element.triggerHandler('scroll');

      elems = getElements($element);
      count = elems.length;
      expect(count).to.equal(14);
      expect($element.scope().vsRepeat.startIndex).to.equal(18);
      expect($element.scope().vsRepeat.endIndex).to.equal(32);

      done();
    });

    it('should properly calculate start and end index with element beyond', function (done) {
      $element = angular.element(`
        <div class="container" style="height: 200px;">
          <div vs-repeat="{size: 20, scrollParent: '.container'}" style="margin: 300px 0">
            <div ng-repeat="foo in bar" class="item">
              <span class="value">{{foo.value}}</span>
            </div>
          </div>
        </div>
      `);

      angular.element(document.body).append($element);
      $compile($element)($scope);
      $scope.bar = getArray(100);
      $scope.$digest();

      const $vsRepeat = $element.children().eq(0);

      let elems = getElements($element);
      let count = elems.length;
      expect(count).to.equal(0);
      expect($vsRepeat.scope().vsRepeat.startIndex).to.equal(0);
      expect($vsRepeat.scope().vsRepeat.endIndex).to.equal(0);

      $element[0].scrollTop = 500;
      $element.triggerHandler('scroll');

      elems = getElements($element);
      count = elems.length;
      expect(count).to.equal(10);
      expect($vsRepeat.scope().vsRepeat.startIndex).to.equal(10);
      expect($vsRepeat.scope().vsRepeat.endIndex).to.equal(20);

      $element[0].scrollTop = $element[0].scrollHeight + $element[0].clientHeight;
      $element.triggerHandler('scroll');

      elems = getElements($element);
      count = elems.length;
      expect(count).to.equal(0);
      expect($vsRepeat.scope().vsRepeat.startIndex).to.equal(100);
      expect($vsRepeat.scope().vsRepeat.endIndex).to.equal(100);

      done();
    });
  });
})();
