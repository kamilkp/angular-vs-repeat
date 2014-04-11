angular-vs-repeat
=================

Virtual Scroll for AngularJS ngRepeat directive

Demo: http://kamilkp.github.io/angular-vs-repeat/

###DESCRIPTION:
`vsRepeat` directive stands for **Virtual Scroll Repeat**. It turns a standard ngRepeated set of elements in a scrollable container
into a component, where the user thinks he has all the elements rendered and all he needs to do is scroll (without any kind of
pagination - which most users loath) and at the same time the browser isn't overloaded by that many elements/angular bindings etc.
The directive renders only so many elements that can fit into current container's clientHeight.

###LIMITATIONS:
- current version works only for vertically stacked elements
- current version only supports an Array as a right-hand-side object for `ngRepeat`
- all rendered elements must have the same predefined height

###USAGE:
First include `vs-repeat` as a module dependency in your app.
Then in order to use the vsRepeat directive you need to measure the single element's height (including all paddings and margins).
You can use any kind of developer tools you like. Let's say that that height is 50px.
example:

```html
<div vs-repeat="50">
		<div ng-repeat="item in someArray">
			<!-- content -->
		</div>
</div>
```

- the vsRepeat directive must be applied to a direct parent of an element with `ngRepeat`
- the value of vsRepeat attribute is the single element's height measured in pixels

###OPTIONAL PARAMETERS (attributes):
`vs-scroll-parent="selector"` - selector to the scrollable container. The directive will look for a closest parent matching
								 the given selector (defaults to the current element)
`vs-top-offset="value"` - top offset in pixels (defaults to 0)
`vs-excess="value"` - an integer number representing the number of elements to be rendered outside of the current container's viewport
					   (defaults to 2)

###EVENTS:
- `vsRepeatTrigger` - an event the directive listens for to manually trigger reinitialization
- `vsRepeatReinitialized` - an event the directive emits upon reinitialization done