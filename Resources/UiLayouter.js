// UI layout module
//
// usage:
//   var UiLayouter = require('UiLayouter');
//   var layouter = new UiLayouter('');
//   layouter.addLayout('header', header);
//   layouter.addLayout('body',   body);
//   layouter.addLayout('footer', footer);

module.exports = (function(global){
	var K = function(){};

	var UiLayouter = function(layoutName){
		var self;

		if (this instanceof UiLayouter) {
			self = this;
		} else {
			self = new K();
		}

		self.layoutName = layoutName;
		self.items      = {};
		self.noOrientationLayout = false;

		Ti.Gesture.addEventListener('orientationchange', function(e){
				applyLayout.call(self);
			});

		applyLayout.call(self);
	};

	K.prototype = UiLayouter.prototype;

	// レイアウトを適用
	function applyLayout() {
		var self = this;

		if (self.noOrientationLayout) {
			return;
		}

		var osname    = Ti.Platform.osname,
		    height    = Ti.Platform.displayCaps.platformHeight,
		    width     = Ti.Platform.displayCaps.platformWidth;
		var isAndroid = osname === 'android';
		var isTablet  = osname === 'ipad' || (isAndroid && (width > 899 || height > 899));

		// 収納ディレクトリ
		//   for Tablet  -> ui/tablet/
		//   for Android -> ui/handheld/android/
		//   for other   -> ui/handheld/

		var dirname = 'ui/';

		if (isTablet) {
			dirname += 'tablet/';
		}
		else {
			if (osname === 'android') {
				dirname += 'handheld/android/';
			}
			else {
				dirname += 'handheld/';
			}
		}

		// ファイル名
		//   for both orientation -> {layoutName}.js
		//   for portrait         -> {layoutName}-port.js
		//   for landscape        -> {layoutName}-land.js
		// ファイル内容
		//   >module.exports = (function() {
		//   >  return {
		//   >    'foo': { // itemName
		//   >      hoge: 'huga', // item property
		//   >       :            //       :
		//   >    }
		//   >  };
		//   >})();

		var basename = dirname + self.layoutName;

		var orientation = Ti.Gesture.isPortrait() ? 'port' : 'land';

		var layout;
		var file;

		try {
			// {layoutName}.js
			layout = require(basename);
			self.noOrientationLayout = true;
		}
		catch(e) {
			// {layoutName}-port.js or {layoutName}-land.js
			layout = require(basename + '-' + orientation);
		}

		self.layout = layout;
		
		// 適用
		for (itemName in self.items) {
			applyLayoutOnce.call(self, itemName);
		}
	}

	// 個別の対象にレイアウトを適用
	function applyLayoutOnce(itemName) {
		var self = this;
		var itemLayout = self.layout[itemName] || {};
		if (self.items[itemName]) {
			var item = self.items[itemName];
			for (key in itemLayout) {
				item[key] = itemLayout[key]
			}
		}
	}

	//-----------------------------------------------------
	// 公開メソッド
	//-----------------------------------------------------

	// レイアウトの対象に含める項目を追加
	UiLayouter.prototype.addItem = function(itemName, item) {
		var self = this;
		// アイテム名とオブジェクトを保存
		self.items = self.items || {};
		self.items[itemName] = item;
		// アイテムにレイアウトを適用
		applyLayoutOnce.call(self, itemName);
	};

	return UiLayouter;
})(this);
