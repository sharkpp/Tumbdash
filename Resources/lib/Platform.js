//	var lib = require('lib');
//	if (lib.Platform.tablet) {}

var this_ = null;

module.exports = (function(global){
	// 既にインスタンスが生成済みの場合は保持している値を返す
	// 基本、require()はキャッシュするのでここは通らない
	if (this_) {
		return this_;
	}

	var lib = require('lib');

	var UI = function(){
		var self = this;

		var osname = Ti.Platform.osname,
			version = Ti.Platform.version,
			height = Ti.Platform.displayCaps.platformHeight,
			width = Ti.Platform.displayCaps.platformWidth;

		self.isAndroid_ = 'android' == osname;
		self.isiOS_     = 'ipad' == osname || 'iphone' == osname;

		if (osname === 'ipad') {
			self.isTablet_ = true;
		}
		else {
			// xdpi, ydpiが未定義のプラットフォームもあるのでその場合はdpiを使用
			var xdpi = Ti.Platform.displayCaps.xdpi == undefined ? Ti.Platform.displayCaps.dpi
			                                                     : Ti.Platform.displayCaps.xdpi;
			var ydpi = Ti.Platform.displayCaps.ydpi == undefined ? Ti.Platform.displayCaps.dpi
			                                                     : Ti.Platform.displayCaps.ydpi;
			var disp_size = Math.sqrt(
					Math.pow(Ti.Platform.displayCaps.platformWidth/xdpi,  2) +
					Math.pow(Ti.Platform.displayCaps.platformHeight/ydpi, 2)
				);
			self.isTablet_ = 6.5 < disp_size; // 6.5インチより大きければタブレット
		}
//		self.isTablet_ = osname === 'ipad' || (osname === 'android' && (width > 899 || height > 899));
	};

	/////////////////////////////////////////


	/////////////////////////////////////////
	// プロパティ
	/////////////////////////////////////////

	// currentWindow プロパティ [RO]
	UI.prototype.__defineGetter__("android", function() {
		return this.tablet_;
	});

	// currentWindow プロパティ [RO]
	UI.prototype.__defineGetter__("iOS", function() {
		return this.tablet_;
	});

	// currentWindow プロパティ [RO]
	UI.prototype.__defineGetter__("tablet", function() {
		return this.tablet_;
	});

	/////////////////////////////////////////
	// メソッド
	/////////////////////////////////////////


	// インスタンスを生成して返す	
	return this_ = new UI;
})(this);
