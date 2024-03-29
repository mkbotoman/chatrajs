/*!
 * Facebook React Starter Kit | https://github.com/kriasoft/React-Seed
 * Copyright (c) KriaSoft, LLC. All rights reserved. See LICENSE.txt
 */

'use strict';

// Include Gulp and other build automation tools and utilities
// See: https://github.com/gulpjs/gulp/blob/master/docs/API.md
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var del = require('del');
var path = require('path');
var merge = require('merge-stream');
var runSequence = require('run-sequence');
var webpack = require('webpack');
var browserSync = require('browser-sync');
var argv = require('minimist')(process.argv.slice(2));

// Settings
var DEST = './build';             // The build output folder
var RELEASE = !!argv.release;         // Minimize and optimize during a build?
var GOOGLE_ANALYTICS_ID = 'UA-XXXXX-X';   // https://www.google.com/analytics/web/
var AUTOPREFIXER_BROWSERS = [         // https://github.com/ai/autoprefixer
  'ie >= 10',
  'ie_mob >= 10',
  'ff >= 30',
  'chrome >= 34',
  'safari >= 7',
  'opera >= 23',
  'ios >= 7',
  'android >= 4.4',
  'bb >= 10'
];

var src = {};
var watch = false;
var reload = browserSync.reload;
var pkgs = (function () {
  var temp = {};
  var map = function (source) {
    for (var key in source) {
      temp[key.replace(/[^a-z0-9]/gi, '')] = source[key].substring(1);
    }
  };
  map(require('./package.json').dependencies);
  return temp;
}());

// The default task
gulp.task('default', ['serve']);

// Clean up
gulp.task('clean', del.bind(null, [DEST]));

// 3rd party libraries
gulp.task('vendor', function () {
  return merge(
    gulp.src('./node_modules/jquery/dist/**')
      .pipe(gulp.dest(DEST + '/vendor/jquery-' + pkgs.jquery)),
    gulp.src('./node_modules/bootstrap/dist/fonts/**')
      .pipe(gulp.dest(DEST + '/fonts'))
  );
});

// Static files
gulp.task('assets', function () {
  src.assets = 'src/assets/**';
  return gulp.src(src.assets)
    .pipe(gulp.dest(DEST))
    .pipe($.if(watch, reload({stream: true})));
});

// Images
gulp.task('images', function () {
  src.images = 'src/images/**';
  return gulp.src(src.images)
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest(DEST + '/images'))
    .pipe($.if(watch, reload({stream: true})));
});

// HTML pages
gulp.task('pages', function () {
  src.pages = 'src/**/*.html';
  return gulp.src(src.pages)
    .pipe($.if(RELEASE, $.htmlmin({
      removeComments: true,
      collapseWhitespace: true,
      minifyJS: true
    })))
    .pipe(gulp.dest(DEST))
    .pipe($.if(watch, reload({stream: true})));
});

// CSS style sheets
gulp.task('styles', function () {
  src.styles = 'src/styles/**/*.{css,less}';
  return gulp.src('src/styles/bootstrap.less')
    .pipe($.plumber())
    .pipe($.less({sourceMap: !RELEASE, sourceMapBasepath: __dirname}))
    .on('error', $.util.log)
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe($.csscomb())
    .pipe($.if(RELEASE, $.minifyCss()))
    .pipe(gulp.dest(DEST + '/css'))
    .pipe($.if(watch, reload({stream: true})));
});

// Bundle
gulp.task('bundle', function (cb) {
  var started = false;
  var config = require('./config/webpack.config.js')(RELEASE);
  var bundler = webpack(config);

  function bundle (err, stats) {
    if (err) {
      throw new $.util.PluginError('webpack', err);
    }

    !!argv.verbose && $.util.log('[webpack]', stats.toString({colors: true}));

    if (watch) {
      reload(config.output.filename);
    }

    if (!started) {
      started = true;
      return cb();
    }
  }

  if (watch) {
    bundler.watch(200, bundle);
  } else {
    bundler.run(bundle);
  }
});

// Build the app from source code
gulp.task('build', ['clean'], function (cb) {
  runSequence(['vendor', 'assets', 'images', 'pages', 'styles', 'bundle'], cb);
});

// Launch a lightweight HTTP Server
gulp.task('serve', function (cb) {

  watch = true;

  runSequence('build', function () {
    browserSync({
      notify: false,
      // Run as an https by uncommenting 'https: true'
      // Note: this uses an unsigned certificate which on first access
      //     will present a certificate warning in the browser.
      // https: true,
      server: {
        baseDir: ['build']
      }
    });

    gulp.watch(src.assets, ['assets']);
    gulp.watch(src.images, ['images']);
    gulp.watch(src.pages, ['pages']);
    gulp.watch(src.styles, ['styles']);
    cb();
  });
});

// Deploy to GitHub Pages
gulp.task('deploy', function () {

  // Remove temp folder
  if (argv.clean) {
    var os = require('os');
    var path = require('path');
    var repoPath = path.join(os.tmpdir(), 'tmpRepo');
    $.util.log('Delete ' + $.util.colors.magenta(repoPath));
    del.sync(repoPath, {force: true});
  }

  return gulp.src(DEST + '/**/*')
    .pipe($.if('**/robots.txt', !argv.production ? $.replace('Disallow:', 'Disallow: /') : $.util.noop()))
    .pipe($.ghPages({
      remoteUrl: 'https://github.com/{name}/{name}.github.io.git',
      branch: 'master'
    }));
});
