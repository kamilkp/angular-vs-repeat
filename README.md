angular-vs-repeat v1.1.7
=================

Looking for a version for Angular 2?
===

Check out https://github.com/kamilkp/ng2-vs-for

---

### Major changes in v1.0.0-beta.0
  * elements are no longer absolutely positioned
  * no need for a mousewheel helper dummy element on MacOS (to preserve inertia scrolling)
  * no need for `top` updating directives - even better performance

[![Build Status](https://travis-ci.org/kamilkp/angular-vs-repeat.svg?branch=master)](https://travis-ci.org/kamilkp/angular-vs-repeat) [![NPM version](https://badge.fury.io/js/angular-vs-repeat.svg)](http://badge.fury.io/js/angular-vs-repeat) [![Bower version](https://badge.fury.io/bo/angular-vs-repeat.svg)](http://badge.fury.io/bo/angular-vs-repeat)

Virtual Scroll for AngularJS ngRepeat directive

Demo: http://kamilkp.github.io/angular-vs-repeat/

You can find the source code for this demo on branch "gh-pages".

Changelog: https://github.com/kamilkp/angular-vs-repeat/blob/master/CHANGELOG.md

###DESCRIPTION:
`vsRepeat` directive stands for **Virtual Scroll Repeat**. It turns a standard ngRepeated set of elements in a scrollable container
into a component, where the user thinks he has all the elements rendered and all he needs to do is scroll (without any kind of
pagination - which most users loath) and at the same time the browser isn't overloaded by that many elements/angular bindings etc.
The directive renders only so many elements that can fit into current container's `clientHeight`/`clientWidth`.

###LIMITATIONS:
- current version only supports an Array as a right-hand-side object for `ngRepeat`
- all rendered elements must have the same height/width or the sizes of the elements must be known up front

###USAGE:
First include `vs-repeat` as a module dependency in your app.
In order to use the vsRepeat directive you need to place a vs-repeat attribute on a direct parent of an element with ng-repeat
example:

```html
<div vs-repeat>
	<div ng-repeat="item in someArray">
		<!-- content -->
	</div>
</div>
```

or:

```html
<div vs-repeat>
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
of the attribute 'vs-repeat'. This can be used if one wants to override the automatically computed element size.
example:

```html
<div vs-repeat="50">	<!-- the specified element height is 50px -->
	<div ng-repeat="item in someArray">
		<!-- content -->
	</div>
</div>
```

- the vsRepeat directive must be applied to a direct parent of an element with `ngRepeat`
- the library also supports ng-repeat-start/ng-repeat-end syntax
- the value of vsRepeat attribute is the single element's height/width measured in pixels. If none provided, the directive will compute it automatically

###OPTIONAL PARAMETERS (attributes):
- `vs-scroll-parent="selector"` - selector to the scrollable container. The directive will look for a closest parent matching the given selector (defaults to the current element). It can also have the value of "window" in which case the directive will hook on the main window scrollbar
- `vs-offset-before="value"` - top/left offset in pixels (defaults to 0)
- `vs-offset-after="value"` - bottom/right offset in pixels (defaults to 0)
- `vs-horizontal` - horizontal mode (the ngRepeat'ed elements should be horizontally stacked)
- `vs-excess="value"` - an integer number representing the number of elements to be rendered outside of the current container's viewport (defaults to 2)
- `vs-size="expression"` - an angular expression evaluated on the item scope that should return the item size. Can be a function or a property name or whatever
- `vs-autoresize` - use this attribute without `vs-size` and without specifying element's size. The automatically computed element style will readjust upon window resize if the size is dependable on the viewport size
- `vs-options="{latch: true}"` enables latching mode - elements once rendered are not being removed when scrolled away (improves scrolling performance when the rendering of each element is time consuming)
- `vs-scrolled-to-end="callback"` callback will be called when the last item of the list is rendered
- `vs-scrolled-to-end-offset="integer"` - set this number to trigger the scrolledToEnd callback n items before the last gets rendered

###EVENTS:
- `vsRepeatTrigger` - an event the directive listens for to manually trigger reinitialization
- `vsRepeatResize` - an event the directive listens for to manually trigger the autosizing algorithm
- `vsRepeatReinitialized` - an event the directive emits upon reinitialization done; the listener may accepts three arguments: `event`, `startIndex` and `endIndex`
