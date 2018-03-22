import gulp from 'gulp';
import babel from 'gulp-babel';
import uglify from 'gulp-uglify';
import rename from 'gulp-rename';
import clean from 'gulp-clean';
import { Server } from 'karma';

gulp.task('babel', () =>
  gulp.src('src/angular-vs-repeat.js')
		.pipe(babel())
		.pipe(gulp.dest('dist'))
);

gulp.task('min', ['babel'], () =>
  gulp.src('dist/angular-vs-repeat.js')
		.pipe(uglify())
		.pipe(rename('angular-vs-repeat.min.js'))
		.pipe(gulp.dest('dist'))
);

gulp.task('karma', ['build'], (done) => {
  new Server({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true,
  }, done).start();
});

gulp.task('karma-travis', ['build'], (done) => {
  new Server({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true,
    browsers: [
      'Firefox',
    ],
  }, done).start();
});

gulp.task('build', ['babel', 'min']);
gulp.task('test', ['build', 'karma']);
gulp.task('travis', ['build', 'karma-travis']);
