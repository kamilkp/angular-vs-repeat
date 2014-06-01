module.exports = function(grunt){
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.initConfig({
		uglify: {
			target: {
				files: {
					'src/angular-vs-repeat.min.js': ['src/angular-vs-repeat.js']
				}
			}
		},
		jshint: {
			all: ['src/angular-vs-repeat.js']
		}
	});

	grunt.registerTask('min', 'Minify javascript source code' ,'uglify');
	grunt.registerTask('min', 'Minify javascript source code' ,'uglify');
	grunt.registerTask('default', ['jshint', 'min']);
};