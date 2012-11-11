//	var lib = require('lib');
//	var w = lib.UI.createWindow({});

var this_ = null;

module.exports = (function(global){
	// 既にインスタンスが生成済みの場合は保持している値を返す
	// 基本、require()はキャッシュするのでここは通らない
	if (this_) {
		return this_;
	}

	var lib = require('lib');

	var UI = function(){};

	/////////////////////////////////////////

	// currentWindow関連
	var currentWindow_ = null;

	// 戻るボタン関連
	var backActionHistory_ = [];
	var backActionToastVisibled_ = false;
	var backActionPush = function(w, callback){
		var isWindow = w instanceof Ti.UI.Window;
		var action = {
				isWindow: isWindow,
				window: isWindow ? w : currentWindow_,
				target: w,
				callback: callback,
			};
		backActionHistory_.push(action);
	}
	var backActionPop = function(){
		var action = backActionHistory_.pop();
		if (action.callback) {
			action.callback();
		}
		else if (!action.isWindow) {
			action.window.remove(action.target);
		}
		else { // if (action.isWindow)
			action.target.close();
		}
	};
	var backActionHook = function(){
		var self = this;
		var isAndroid = Ti.Platform.osname === 'android';
		if (backActionHistory_.length <= 1) {
			if (!backActionToastVisibled_ && isAndroid) {
				Ti.UI.createNotification({
						message: 'もう一度押すと終了',
						duration: Ti.UI.NOTIFICATION_DURATION_SHORT
					}).show();
				backActionToastVisibled_ = true;
				setTimeout(function(){ backActionToastVisibled_ = false; }, 2500);
				return;
			}
		}
		backActionPop.call(self);
	};

	/////////////////////////////////////////
	// プロパティ
	/////////////////////////////////////////

	// currentWindow プロパティ [RO]
	UI.prototype.__defineGetter__("currentWindow", function() {
		return currentWindow_;
	});

	/////////////////////////////////////////
	// メソッド
	/////////////////////////////////////////

	// createWindow(params)
	// ほぼ単なる Ti.UI.createWindow() のラッパー
	UI.prototype.createWindow = function(params){
		var w = Ti.UI.createWindow(params);
		this.registerWindow(w);
		return w;
	};

	// getCurrentWindow()
	// 現在のウインドウを取得
	UI.prototype.getCurrentWindow = function(){
		return this.currentWindow;
	};

	// registerWindow()
	// ウインドウを登録
	UI.prototype.registerWindow = function(window){
		var self = this;
		window.addEventListener('focus', function(){
				currentWindow_ = window;
//Ti.UI.createNotification({message: 'focus'}).show();
			});
//		window.addEventListener('blur', function(){
//				currentWindow_ = null;
//	Ti.UI.createNotification({message: 'blur'}).show();
//			});
		window.addEventListener('android:back', backActionHook);
		backActionPush.call(self, window);
	};

	// createLightWindow(params)
	// 現在のウインドウを取得
	UI.prototype.createLightWindow = function(params){
		params = params || {};
		var visible = params['visible'] || false;
		params['top']    = '0';
		params['left']   = '0';
		params['width']  = '100%';
		params['height']  = '100%';
		params['visible'] = true;
		var self = this;
		var w = currentWindow_;
		var v = Ti.UI.createView({
					top: '0',
					left: '0',
					width: '100%',
					height: '100%',
					visible: visible
				});
		var bg = Ti.UI.createView(params);
		v.add(bg);
//		w.addEventListener('android:back', fn);
		w.add(v);
		// 戻るボタンのために状態を保存
		backActionPush.call(self, w, function(){
				w.remove(v);
				v.fireEvent('blur', {
						source: v,
						type: 'blur',
					});
				v.fireEvent('close', {
						source: v,
						type: 'close',
					});
			});
		// Ti.UI.Viewを拡張
		lib.extend(v, {
				open: function(){
						v.show();
						v.fireEvent('open', {
							source: v,
							type: 'open',
						});
						v.fireEvent('focus', {
							source: v,
							type: 'focus',
						});
					},
				close: function(){ backActionHook.call(self); },
			});
		//
		return v;
	};

	// インスタンスを生成して返す	
	return this_ = new UI;
})(this);
