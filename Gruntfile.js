module.exports = function(grunt){
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-karma');

	grunt.initConfig({
		uglify: {
			target: {
				files: {
					'src/angular-vs-repeat.min.js': ['src/angular-vs-repeat.js']
				},
				options: {
					banner: [
						'//',
						'// Copyright Kamil Pękala http://github.com/kamilkp',
						'// Angular Virtual Scroll Repeat v1.1.7 2016/03/08',
						'//',
						''
					].join('\n')
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
			},
			travis: {
				configFile: 'karma.conf.js',
				singleRun: true,
				browsers: [
					'Firefox'
				]
			}
		}
	});

	grunt.registerTask('min', 'Minify javascript source code', 'uglify');
	grunt.registerTask('test', 'Run unit tests', ['jshint', 'min', 'karma:unit']);
	grunt.registerTask('default', ['test']);
	grunt.registerTask('travis', ['jshint', 'min', 'karma:travis']);
};