//	var lib = require('lib');
//	var w = lib.UI.createWindow({});

var this_ = null;

module.exports = (function(global){
	// 既にインスタンスが生成済みの場合は保持している値を返す
	// 基本、require()はキャッシュするのでここは通らない
	if (this_) {
		return this_;
	}
	
	var lib = function(){};

	/////////////////////////////////////////
	// プロパティ
	/////////////////////////////////////////

	// UIプロパティ
	lib.prototype.__defineGetter__("UI", function(){
		if (this.UI_)
			return this.UI_;
		return this.UI_ = require('lib/UI');
	});

	// Logプロパティ
	lib.prototype.__defineGetter__("Log", function(){
		if (this.Log_)
			return this.Log_;
		return this.Log_ = require('lib/Log');
	});

	/////////////////////////////////////////
	// メソッド
	/////////////////////////////////////////

	// extend
	// オブジェクトの拡張
	lib.prototype.extend = function(dest, src){
		for (key in src) {
			dest[key] = src[key];
		}
		return dest;
	};

	// インスタンスを生成して返す	
	return this_ = new lib;
})(this);
