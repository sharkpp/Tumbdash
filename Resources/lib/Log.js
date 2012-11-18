// Loggger Component Constructor

// usage:
//  var lib = require('lib');
//  lib.Log.setLogDir('./');
//  lib.Log.info('hoge');
//  lib.Log.debug('fuga');

var this_ = null;

module.exports = (function(global){
	// 既にインスタンスが生成済みの場合は保持している値を返す
	// 基本、require()はキャッシュするのでここは通らない
	if (this_) {
		return this_;
	}

	var lib = require('lib');

	var Log = function(){
		this.setLogDir('./');
		this.setLogLevel(this.LEVEL_NONE);
	};

	/////////////////////////////////////////

	Log.prototype.LEVEL_NONE    = 0;
	Log.prototype.LEVEL_ERROR   = 1;
	Log.prototype.LEVEL_WARNING = 2;
	Log.prototype.LEVEL_INFO    = 3;
	Log.prototype.LEVEL_DEBUG   = 4;

	var levelText = {
			1: 'ERROR',
			2: 'WARNING',
			3: 'INFO',
			4: 'DEBUG',
		};

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
							, year, date.getMonth() + 1, date.getDate());
		data = String.format("%04d-%02d-%02d %02d:%02d:%02d.%03d [%s] %s\n"
							, year, date.getMonth() + 1, date.getDate()
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

	/////////////////////////////////////////
	// メソッド
	/////////////////////////////////////////

	// ログの出力フォルダを指定
	Log.prototype.setLogDir = function(baseDir) {
		this.baseDir = baseDir;
	}

	// ログの出力レベルを指定
	Log.prototype.setLogLevel = function(logLevel) {
		this.logLevel = logLevel || 1;
	}

	// デバッグレベルのログを出力
	Log.prototype.debug = function(message) {
		logger.call(this, this.LEVEL_DEBUG, message);
	}

	// 情報レベルのログを出力
	Log.prototype.info = function(message) {
		logger.call(this, this.LEVEL_INFO, message);
	}

	// 警告レベルのログを出力
	Log.prototype.warning = function(message) {
		logger.call(this, this.LEVEL_WARNING, message);
	}

	// エラーレベルのログを出力
	Log.prototype.error = function(message) {
		logger.call(this, this.LEVEL_ERROR, message);
	}

	return this_ = new Log;
})(this);
