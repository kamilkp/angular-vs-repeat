angular-vs-repeat v2.0.9
=================

Looking for a version for Angular 2?
===

Check out https://github.com/kamilkp/ng2-vs-for

---

### Breaking changes in v2.x
  * API changes for passing options. Options are now passed as an object to the `vs-repeat` attribute
    instead of using separate attributes for each option (except for `vs-repeat-container`)

### Major changes in v1.0.0-beta.0
  * elements are no longer absolutely positioned
  * no need for a mousewheel helper dummy element on MacOS (to preserve inertia scrolling)
  * no need for `top` updating directives - even better performance

[![Build Status](https://travis-ci.org/kamilkp/angular-vs-repeat.svg?branch=master)](https://travis-ci.org/kamilkp/angular-vs-repeat) [![NPM version](https://badge.fury.io/js/angular-vs-repeat.svg)](http://badge.fury.io/js/angular-vs-repeat) [![Bower version](https://badge.fury.io/bo/angular-vs-repeat.svg)](http://badge.fury.io/bo/angular-vs-repeat)

Virtual Scroll for AngularJS ngRepeat directive

Demo: http://kamilkp.github.io/angular-vs-repeat/

You can find the source code for this demo on branch "gh-pages".

Changelog: https://github.com/kamilkp/angular-vs-repeat/blob/master/CHANGELOG.md

### DESCRIPTION:
`vsRepeat` directive stands for **Virtual Scroll Repeat**. It turns a standard ngRepeated set of elements in a scrollable container
into a component, where the user thinks he has all the elements rendered and all he needs to do is scroll (without any kind of
pagination - which most users loath) and at the same time the browser isn't overloaded by that many elements/angular bindings etc.
The directive renders only so many elements that can fit into current container's `clientHeight`/`clientWidth`.

### LIMITATIONS:
- current version only supports an Array as a right-hand-side object for `ngRepeat`
- all rendered elements must have the same height/width or the sizes of the elements must be known up front

### USAGE:
First include `vs-repeat` as a module dependency in your app.
In order to use the vsRepeat directive you need to place a vs-repeat attribute on a direct parent of an element with ng-repeat
example:

```html
<div vs-repeat="options">
	<div ng-repeat="item in someArray">
		<!-- content -->
	</div>
</div>
```

or:

```html
<div vs-repeat="options">
     <div ng-repeat-start="item in someArray">
         <!-- content -->
     </div>
     <div>
        <!-- something in the middle -->
     </div>
     <div ng-repeat-end>
         <!-- content -->
     </div>
</div>
```

You can also measure the single element's height/width (including all paddings and margins), and then speficy it as a value
of the options' `size` property. This can be used if one wants to override the automatically computed element size.
example:

```html
<div vs-repeat="{size: 50}">	<!-- the specified element height is 50px -->
	<div ng-repeat="item in someArray">
		<!-- content -->
	</div>
</div>
```

- the vsRepeat directive must be applied to a direct parent of an element with `ngRepeat`
- the library also supports ng-repeat-start/ng-repeat-end syntax
- the value of vsRepeat attribute is the single element's height/width measured in pixels. If none provided, the directive will compute it automatically

### OPTIONAL PARAMETERS (attributes):
- vs-repeat-container="selector" - selector for element containing ng-repeat. (defaults to the current element)

### OPTIONS:

Options shall be passed as an object to the `vs-repeat` attribute e.g.:

```html
<div vs-repeat="{scrollParent: 'window', size: 20}"></div>
```

**Available options**:
- `horizontal` - boolean; stack repeated elements horizontally instead of vertically (defaults to false)
- `offset-before` - top/left offset in pixels (defaults to 0)
- `offset-after` - bottom/right offset in pixels (defaults to 0)
- `scroll-margin` - how many pixels ahead should elements be rendered while scrolling (defaults to 0)
- `latch` - if true, elements will be rendered gradually but won't be removed when scrolled away (defaults to false)

- `size` - an angular expression evaluating to the element's size (in pixels) - **it is possible to use the ngRepeat's local repeaing variable in this expression**
- `autoresize` - use this attribute without vs-size and without specifying element's size. The automatically computed element style will
              readjust upon window resize if the size is dependable on the viewport size
- `scrolled-to-end` - callback will be called when the last item of the list is rendered
- `scrolled-to-end-offset` - set this number to trigger the scrolledToEnd callback n items before the last gets rendered
- `scrolled-to-beginning` - callback will be called when the first item of the list is rendered
- `scrolled-to-beginning-offset` - set this number to trigger the scrolledToBeginning callback n items before the first gets rendered

### EVENTS:
- `vsRepeatTrigger` - an event the directive listens for to manually trigger reinitialization
- `vsRepeatResize` - an event the directive listens for to manually trigger the autosizing algorithm
- `vsRepeatReinitialized` - an event the directive emits upon reinitialization done; the listener may accepts three arguments: `event`, `startIndex` and `endIndex`
