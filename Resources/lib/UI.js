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
		if (action.menuInfo) {
		//	var menu = action.menuInfo.menu;
		//	var menuItems = action.menuInfo.menuItems;
		//	for (var i = 0, itemId; itemId = menuItems[i]; i++) {
		//		var item = menu.findItem(itemId);
		//		item.enabled = true;
		//	}
			if (action.window.activity) {
				action.menuInfo.menu.clear();
				action.window.activity.fireEvent('menucreate', action.menuInfo);
			}
		}
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
			});
		window.addEventListener('android:back', backActionHook);
		window.addEventListener('open', function(e){
				var activity = window.activity;
				activity.onCreateOptionsMenu = function(e){
						activity.fireEvent('menucreate', e);
					};
				activity.onPrepareOptionsMenu = function(e){
						activity.fireEvent('menuprepare', e);
					};
				activity.addEventListener('menuprepare', function(e){
						var action = backActionHistory_[backActionHistory_.length - 1];
						if (!action.isWindow) {
						//	var menuItems = [];
						//	for (var i = 0, item; item = e.menu.items[i]; i++) {
						//		if (item.enabled) {
						//			menuItems.push(item.itemId);
						//			item.enabled = false;
						//		}
						//	}
						//	action.menuInfo = {
						//			menu: e.menu,
						//			menuItems: menuItems,
						//		};
							action.menuInfo = e;
							e.menu.clear();
							var menuBack = e.menu.add({ title : '戻る' });
							menuBack.setIcon(Ti.Android.R.drawable.ic_menu_revert);
							menuBack.addEventListener('click', function(e) {
									backActionHook.call(self);
								});
//Ti.UI.createNotification({message:'clear menu #'}).show();
						}
//Ti.UI.createNotification({message:'prepare mene #2,'+backActionHistory_.length}).show();
					});
			});
		backActionPush.call(self, window);
		// Ti.UI.Windowを拡張
//		var getActivityOrigin = window.getActivity;
//		lib.extend(window, {
//				getActivity: function() {
//						var activity = window.activity;
//						if (!activity)
//							return activity;
//						var MyActivity = require('lib/Android/Activity');
//						return new MyActivity(activity);
//					},
//				getActivityOrigin: getActivityOrigin,
//			});
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
		backActionPush.call(self, v, function(){
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

	// createLayouter(params)
	UI.prototype.createLayouter = function(params){
		var Layouter = require('lib/UI/Layouter');
		return new Layouter(params);
	};

	// インスタンスを生成して返す	
	return this_ = new UI;
})(this);
