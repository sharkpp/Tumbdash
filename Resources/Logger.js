// Loggger Component Constructor

// usage:
//  var log = require('Logger').create('./');
//  log.info();

var exports = exports || this;
exports.create = (function(global){
	var K = function(){};

	var create = function(baseDir, logLevel) {
		var self;

		if (this instanceof create) {
			self = this;
		} else {
			self = new K();
		}

		self.setBaseDir(baseDir);
		self.setLogLevel(logLevel);

		return self;
	};

	K.prototype = create.prototype;

	create.prototype.LEVEL_NONE    = 0;
	create.prototype.LEVEL_ERROR   = 1;
	create.prototype.LEVEL_WARNING = 2;
	create.prototype.LEVEL_INFO    = 3;
	create.prototype.LEVEL_DEBUG   = 4;

	var levelText = {};
	levelText[1] = 'ERROR';
	levelText[2] = 'WARNING';
	levelText[3] = 'INFO';
	levelText[4] = 'DEBUG';

	// 
	function logger(level, message) {
		var self = this;
		if (self.logLevel < level) {
			return;
		}
		var date = new Date();
		var year = date.getFullYear ? date.getFullYear()
		                            : date.getYear() < 2000 ? date.getYear() + 2000
		                                                    : date.getYear();
		var fileName = String.format('%s/%04d%02d%02d.log'
							, self.baseDir
							, year, date.getMonth() + 1, date.getDay());
		data = String.format("%04d-%02d-%02d %02d:%02d:%02d.%03d [%s] %s\n"
							, year, date.getMonth() + 1, date.getDay()
							, date.getHours(), date.getMinutes(), date.getSeconds()
							, date.getMilliseconds()
							, levelText[level], message);
		var file = Ti.Filesystem.getFile(fileName);
		if (file) {
			if (file.append) {
				file.append(data);
			} else {
				file.write(file.read() + data);
			}
		}
	}


	// 
	create.prototype.setBaseDir = function(baseDir) {
		var self = this;
		self.baseDir = baseDir;
	}

	// 
	create.prototype.setLogLevel = function(logLevel) {
		var self = this;
		self.logLevel = logLevel || 1;
	}

	// 
	create.prototype.debug = function(message) {
		logger.call(this, this.LEVEL_DEBUG, message);
	}

	// 
	create.prototype.info = function(message) {
		logger.call(this, this.LEVEL_INFO, message);
	}

	// 
	create.prototype.warning = function(message) {
		logger.call(this, this.LEVEL_WARNING, message);
	}

	// 
	create.prototype.error = function(message) {
		logger.call(this, this.LEVEL_ERROR, message);
	}

	return create;
})(this);
