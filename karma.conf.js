module.exports = function(config) {
	config.set({
		frameworks: ['mocha'],

		// list of files / patterns to load in the browser
		files: [
			'node_modules/expect.js/index.js',
			'lib/angular.js',
			'src/angular-vs-repeat.min.js',
			'lib/angular-mocks.js',
			'test/spec.js',
		],

		// use dots reporter, as travis terminal does not support escaping sequences
		// possible values: 'dots', 'progress',
		// CLI --reporters progress
		reporters: ['progress'],

		// web server port
		// CLI --port 9876
		port: 9876,

		// enable / disable colors in the output (reporters and logs)
		// CLI --colors --no-colors
		colors: true,

		// level of logging
		// possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
		// CLI --log-level debug
		logLevel: config.LOG_INFO,

		// enable / disable watching file and executing tests whenever any file changes
		// CLI --auto-watch --no-auto-watch
		autoWatch: true,

		// Start these browsers, currently available:
		// - Chrome
		// - ChromeCanary
		// - Firefox
		// - Opera
		// - Safari (only Mac)
		// - PhantomJS
		// - IE (only Windows)
		browsers: [
			'Chrome',
			//'Firefox',
			//'Opera',
			//'IE',
		],

		// If browser does not capture in given timeout [ms], kill it
		// CLI --capture-timeout 5000
		captureTimeout: 300000,

		// Auto run tests on start (when browsers are captured) and exit
		// CLI --single-run --no-single-run
		singleRun: false,

		// report which specs are slower than 500ms
		// CLI --report-slower-than 500
		reportSlowerThan: 5000,

		plugins: [
			'karma-mocha',
			'karma-chrome-launcher',
			'karma-firefox-launcher'
		]
	});
};