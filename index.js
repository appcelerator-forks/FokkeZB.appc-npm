var path = require('path');

var fs = require('fs-extra');
var async = require('async');
var _ = require('underscore');

module.exports = function (opts, callback) {

	if (arguments.length === 1) {
		callback = opts;
		opts = {};

	} else {
		opts = opts || {};
	}

	var src = opts.src || process.cwd();
	var type = opts.type;

	var pkg = {};

	var packagePath = path.join(src, 'package.json');

	return async.series({

		validate: function (next) {

			if (!type) {
				return next(new Error('Type is missing'));
			}

			if (!src) {
				return next(new Error('Source is missing'));
			}

			try {
				type = require(path.join(__dirname, 'lib', 'types', type));

			} catch (e) {
				return next(new Error('Unknown type: ' + type));
			}

			return fs.stat(src, function (err, stats) {

				if (err) {
					return next(new Error('Could not find source: ' + src));
				}

				if (!stats.isDirectory()) {
					return next(new Error('Source is not a directory: ' + src));
				}

				return next();

			});

		},

		copyInstaller: function (next) {

			return fs.copy(path.join(__dirname, 'assets', 'appc-npm'), path.join(src, 'appc-npm'), function (err) {

				if (err) {
					return next(new Error('Failed to copy the installer'));
				}

				return next();
			});

		},

		readPackage: function (next) {

			return fs.exists(packagePath, function (exists) {

				if (!exists) {
					return next();
				}

				return fs.readJson(packagePath, function (err, json) {

					if (err) {
						return next(new Error('Failed to read package.json'));
					}

					pkg = json;

					return next();
				});

			});

		},

		updatePackage: function (next) {
			var mod;

			return type.analyze(src, function (err, info) {

				if (err) {
					return next(err);
				}

				// don't overwrite...
				_.defaults(pkg, info);

				// only version, falling back to 1.0.0
				pkg.version = info.version || pkg.version || '1.0.0';

				// fallback for name
				pkg.name = pkg.name || type.prefix + path.dirname(src);

				if (typeof pkg.scripts !== 'object') {
					pkg.scripts = {};
				}

				// don't overwrite postinstall
				if (!pkg.scripts.postinstall) {
					pkg.scripts.postinstall = 'node ./appc-npm';
				}

				return next();
			});

		},

		writePackage: function (next) {

			return fs.outputJson(packagePath, pkg, function (err) {

				if (err) {
					return next(new Error('Failed to write package.json'));
				}

				return next();
			});

		}

	}, function (err) {

		if (err) {
			return callback(err);
		}

		return callback(null, pkg);
	});
};