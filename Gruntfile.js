module.exports = function(grunt){
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-karma');

	grunt.initConfig({
		uglify: {
			target: {
				files: {
					'src/angular-vs-repeat.min.js': ['src/angular-vs-repeat.js']
				}
			}
		},
		jshint: {
			all: [
				'src/angular-vs-repeat.js',
				'Gruntfile.js',
				'test/spec.js',
				'karma.conf.js'
			]
		},
		karma: {
			unit: {
				configFile: 'karma.conf.js',
				singleRun: true,
			}
		}
	});

	grunt.registerTask('min', 'Minify javascript source code', 'uglify');
	grunt.registerTask('test', 'Run unit tests', ['jshint', 'min', 'karma:unit']);
	grunt.registerTask('default', ['test']);
};