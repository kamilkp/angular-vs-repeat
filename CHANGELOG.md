Version 1.0.0-rc2 (2014/06/09)
=================
Semver compatible version name

Version 1.0.0rc1 (2014/06/02)
=================

###FEATURES
- added travis-ci integration
- added unit tests
- added minified version of the library
- fixed some minor bugs
- updated the [DEMO](http://kamilkp.github.io/angular-vs-repeat/) that now also address the performance benefits of using the library

Version 0.3 (2014/05/30)
=================

###FEATURES
- support for automatic computation of repeated elements' `height`/`width`

###BREAKING CHANGE:
- specifying the single element's size as a value of the `vs-repeat` attribute is no longer required. If it isn't provided the directive will calculate it automatically (once, the first time it renders at least one element). If for some reason you want to override that size, you can still provide is as a value of the `vs-repeat` attribute.

Version 0.2 (2014/05/25)
=================

###FEATURES
- support for horizontally stacked elements (a `vs-horizontal` attribute must be placed on the element)
- no need to use jQuery, `vsRepeat` can now work with angular (jqLite) only
- support for before/after offsets (in pixels) via `vs-offset-before` and `vs-offset-after`
- full support for nested `vsRepeat`s and scrolling in both directions even within the same container

###BREAKING CHANGE:
- `vs-top-offset` attribute is now called `vs-offset-before`

Version 0.1
=================

###FEATURES
- support for vertically stacked elements